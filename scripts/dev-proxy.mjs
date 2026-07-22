import http from "node:http";
import { URL } from "node:url";

const PROXY_PORT = Number(process.env.DEV_PROXY_PORT ?? 3000);
const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:8080";
const WEB_TARGET = process.env.WEB_TARGET ?? "http://127.0.0.1:19145";

function targetFor(req) {
  const path = req.url?.split("?")[0] ?? "/";
  return path.startsWith("/api") ? API_TARGET : WEB_TARGET;
}

function proxyRequest(req, res) {
  const target = new URL(targetFor(req));
  const clientHost = req.headers.host;
  const headers = {
    ...req.headers,
    host: target.host,
    "x-forwarded-host": clientHost ?? req.headers["x-forwarded-host"],
    "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? "http",
    "x-forwarded-for": req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "",
  };

  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Bad gateway", message: err.message }));
      return;
    }
    res.end();
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(req, socket, head) {
  const target = new URL(targetFor(req));
  const clientHost = req.headers.host;
  const proxyReq = http.request({
    hostname: target.hostname,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: target.host,
      "x-forwarded-host": clientHost ?? req.headers["x-forwarded-host"],
      "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? "http",
      "x-forwarded-for": req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "",
    },
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
