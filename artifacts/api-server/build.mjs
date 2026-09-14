import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild, context as esbuildContext } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(artifactDir, "dist");
const isWatch = process.argv.includes("--watch");

export function createBuildId() {
  return `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

export async function writeBuildMeta(buildId) {
  const meta = { buildId, builtAt: new Date().toISOString() };
  await writeFile(path.join(distDir, "build-meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

function getEsbuildOptions(extraPlugins = []) {
  return {
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "openai",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
      "pdfkit",
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
      "@thednp/dommatrix",
    ],
    sourcemap: "linked",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] }), ...extraPlugins],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  };
}

export async function buildOnce() {
  await rm(distDir, { recursive: true, force: true });
  await esbuild(getEsbuildOptions());
  const buildId = createBuildId();
  await writeBuildMeta(buildId);
  return buildId;
}

async function runWatch() {
  const { spawn } = await import("node:child_process");

  let child = null;

  const startServer = () => {
    if (child) {
      child.kill("SIGTERM");
      child = null;
    }
    child = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
      cwd: artifactDir,
      stdio: "inherit",
      env: process.env,
    });
  };

  const restartPlugin = {
    name: "api-dev-restart",
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length > 0) return;
        const buildId = createBuildId();
        await writeBuildMeta(buildId);
        console.info(`[dev-watch] Build ${buildId} — restarting API`);
        startServer();
      });
    },
  };

  await rm(distDir, { recursive: true, force: true });
  const ctx = await esbuildContext(getEsbuildOptions([restartPlugin]));

  const first = await ctx.rebuild();
  if (first.errors.length > 0) {
    process.exit(1);
  }

  await ctx.watch();
  console.info("[dev-watch] Watching API source for changes…");

  const shutdown = () => {
    void ctx.dispose();
    if (child) child.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main() {
  if (isWatch) {
    await runWatch();
    return;
  }
  await buildOnce();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
