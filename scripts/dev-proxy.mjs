import http from "node:http";
import { URL } from "node:url";

const PROXY_PORT = Number(process.env.DEV_PROXY_PORT ?? 3000);
const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:8080";
const WEB_TARGET = process.env.WEB_TARGET ?? "http://127.0.0.1:19145";
const UPSTREAM_RETRIES = Number(process.env.DEV_PROXY_RETRIES ?? 3);
const UPSTREAM_RETRY_MS = Number(process.env.DEV_PROXY_RETRY_MS ?? 1500);

function targetFor(req) {
  const path = req.url?.split("?")[0] ?? "/";
  if (path === "/__devproxy/health") return null;
  return path.startsWith("/api") ? API_TARGET : WEB_TARGET;
}

function buildForwardHeaders(req, target) {
  const clientHost = req.headers.host;
  return {
    ...req.headers,
    host: target.host,
    "x-forwarded-host": clientHost ?? req.headers["x-forwarded-host"],
    "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? "http",
    "x-forwarded-for": req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "",
  };
}

function probe(url) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "GET",
        timeout: 3000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

async function healthPayload() {
  const [apiOk, webOk] = await Promise.all([
    probe(`${API_TARGET}/api/healthz`),
    probe(`${WEB_TARGET}/`),
  ]);
  return { api: apiOk, web: webOk, ok: apiOk && webOk };
}

function sendServiceDown(res, targetUrl, label) {
  res.writeHead(503, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html>
<html><head><title>Dev service starting</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#334155">
  <h1 style="color:#0f172a">Dev ${label} is not ready</h1>
  <p>The Cloudflare tunnel is up, but <code>${label}</code> at <code>${targetUrl}</code> is not responding yet.</p>
  <p>Run <code>bash scripts/dev-stack.sh</code> on the dev machine and wait until it prints <strong>Stack ready</strong>.</p>
  <p><a href="/">Retry</a></p>
</body></html>`);
}

function proxyRequest(req, res, attempt = 0) {
  const path = req.url?.split("?")[0] ?? "/";
  if (path === "/__devproxy/health") {
    void healthPayload().then((payload) => {
      res.writeHead(payload.ok ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    });
    return;
  }

  const upstream = targetFor(req);
  if (!upstream) {
    res.writeHead(404);
    res.end();
    return;
  }

  const target = new URL(upstream);
  const headers = buildForwardHeaders(req, target);
  const label = upstream === API_TARGET ? "API server" : "frontend";

  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers,
      timeout: 30_000,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (attempt < UPSTREAM_RETRIES) {
      setTimeout(() => proxyRequest(req, res, attempt + 1), UPSTREAM_RETRY_MS);
      return;
    }
    if (!res.headersSent) sendServiceDown(res, upstream, label);
  });

  proxyReq.on("error", () => {
    if (attempt < UPSTREAM_RETRIES) {
      setTimeout(() => proxyRequest(req, res, attempt + 1), UPSTREAM_RETRY_MS);
      return;
    }
    if (!res.headersSent) sendServiceDown(res, upstream, label);
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(req, socket, head) {
  const upstream = targetFor(req);
  if (!upstream) {
    socket.destroy();
    return;
  }
  const target = new URL(upstream);
  const proxyReq = http.request({
    hostname: target.hostname,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: buildForwardHeaders(req, target),
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 ${proxyRes.statusCode ?? 101} ${proxyRes.statusMessage ?? "Switching Protocols"}\r\n` +
        Object.entries(proxyRes.headers)
          .filter(([, value]) => value != null)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    if (proxyHead?.length) proxySocket.write(proxyHead);
    if (head?.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", () => socket.destroy());
  proxyReq.end();
}

const server = http.createServer(proxyRequest);
server.on("upgrade", proxyUpgrade);

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`Dev proxy listening on http://127.0.0.1:${PROXY_PORT}`);
  console.log(`  /api* -> ${API_TARGET}`);
  console.log(`  /*    -> ${WEB_TARGET}`);
});
