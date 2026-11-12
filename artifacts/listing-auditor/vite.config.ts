import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const listingAuditorRoot = path.dirname(fileURLToPath(import.meta.url));
const distPublicDir = path.join(listingAuditorRoot, "dist/public");

const appBuildId =
  process.env.VITE_APP_BUILD_ID?.trim() ||
  (process.env.NODE_ENV === "production"
    ? `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`
    : "dev");

function appBuildIdPlugin(buildId: string): Plugin {
  return {
    name: "app-build-id-json",
    async closeBundle() {
      if (buildId === "dev") return;
      await writeFile(
        path.join(distPublicDir, "build-id.json"),
        `${JSON.stringify({ buildId }, null, 2)}\n`,
        "utf8",
      );
    },
  };
}

const previewNoCachePaths = new Set(["/", "/index.html", "/build-id.json"]);

function previewNoCachePlugin(): Plugin {
  return {
    name: "preview-no-cache-shell",
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url ?? "/").split("?")[0];
        if (previewNoCachePaths.has(pathOnly) || pathOnly.endsWith("/build-id.json")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
          res.setHeader("Pragma", "no-cache");
        }
        next();
      });
    },
  };
}

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8080";

// Cloudflare / dev-proxy cannot forward Vite HMR websockets (see scripts/dev-proxy.mjs).
const disableHmr =
  process.env.VITE_DISABLE_HMR === "true" || Boolean(process.env.VITE_CLERK_PROXY_URL);

function devStackDefaultsToNativeAuth(): boolean {
  if (process.env.DEV_STACK_USE_CLERK === "true") return false;
  const explicit = process.env.VITE_AUTH_PROVIDER?.trim();
  if (explicit === "clerk") return false;
  if (explicit === "native") return true;
  if (process.env.DEV_STACK_NATIVE_AUTH === "1") return true;
  if (process.env.CURSOR_AGENT === "1") return true;
  return existsSync("/tmp/dev-stack-native-auth.marker");
}

const useNativeAuthProvider =
  process.env.VITE_AUTH_PROVIDER === "native" || devStackDefaultsToNativeAuth();

/** Small VPS / deploy hosts: less Rollup parallelism + skip gzip size report (saves RAM). */
const lowMemoryBuild =
  process.env.VITE_BUILD_LOW_MEMORY === "1" || process.env.VITE_BUILD_LOW_MEMORY === "true";

function manualChunkForId(id: string): string | undefined {
  if (
    id.includes("/src/lib/utils") ||
    id.includes("clsx") ||
    id.includes("tailwind-merge")
  ) {
    return "vendor-utils";
  }

  if (!id.includes("node_modules")) return;

  if (id.includes("@clerk")) return "vendor-clerk";
  if (id.includes("@tanstack/react-query")) return "vendor-react-query";
  if (
    id.includes("/react-dom/") ||
    id.includes("/react/") ||
    id.includes("scheduler")
  ) {
    return "vendor-react";
  }
  if (id.includes("lucide-react")) return "vendor-icons";
  if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
  if (id.includes("@radix-ui")) return "vendor-radix";
  if (id.includes("framer-motion")) return "vendor-motion";
}

export default defineConfig({
  base: basePath,
  define: {
    "import.meta.env.VITE_APP_BUILD_ID": JSON.stringify(appBuildId),
    ...(useNativeAuthProvider
      ? { "import.meta.env.VITE_AUTH_PROVIDER": JSON.stringify("native") }
      : {}),
  },
  plugins: [
    appBuildIdPlugin(appBuildId),
    previewNoCachePlugin(),
    react(),
    tailwindcss({ optimize: process.env.NODE_ENV === "production" }),
    // Vite dev + runtime error overlay breaks behind Cloudflare quick tunnels (no HMR websocket).
    ...(disableHmr ? [] : [runtimeErrorOverlay()]),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      ...(useNativeAuthProvider
        ? {
            "@clerk/react": path.resolve(import.meta.dirname, "src/lib/native-clerk-shim.tsx"),
          }
        : {}),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    reportCompressedSize: !lowMemoryBuild,
    ...(lowMemoryBuild
      ? {
          rollupOptions: {
            maxParallelFileOps: 2,
            output: {
              manualChunks(id) {
                return manualChunkForId(id);
              },
            },
          },
        }
      : {
          rollupOptions: {
            output: {
              manualChunks(id) {
                return manualChunkForId(id);
              },
            },
          },
        }),
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: disableHmr ? false : undefined,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
