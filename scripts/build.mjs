#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const isTruthy = (value) => Boolean(value && value !== "0" && value !== "false");

// Cloudflare Workers Builds (`WORKERS_CI`) and Pages (`CF_PAGES`) run `npm run build`
// by default before `npx wrangler deploy`, which expects `.open-next/` build artifacts.
const isCloudflareCI =
  isTruthy(process.env.WORKERS_CI) || isTruthy(process.env.CF_PAGES);

const shouldRunOpenNextBuild =
  isCloudflareCI && process.env.NEXT_PRIVATE_STANDALONE !== "true";

const extraArgs = process.argv.slice(2);

const [binPath, args] = shouldRunOpenNextBuild
  ? [
      path.join(ROOT, "node_modules/@opennextjs/cloudflare/dist/cli/index.js"),
      ["build", ...extraArgs],
    ]
  : [
      path.join(ROOT, "node_modules/next/dist/bin/next"),
      ["build", "--webpack", ...extraArgs],
    ];

if (shouldRunOpenNextBuild) {
  console.log(
    "[build] Cloudflare CI detected: building OpenNext bundle via @opennextjs/cloudflare..."
  );
}

const result = spawnSync(process.execPath, [binPath, ...args], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (shouldRunOpenNextBuild && (result.status ?? 1) === 0) {
  const cacheSrc = path.join(ROOT, ".open-next", "cache");
  const staticCacheDest = path.join(ROOT, ".open-next", "assets", "cdn-cgi", "_next_cache");
  if (fs.existsSync(cacheSrc)) {
    fs.cpSync(cacheSrc, staticCacheDest, { recursive: true });
    console.log("[build] Populated .open-next/assets/cdn-cgi/_next_cache from .open-next/cache.");
  }
}

process.exit(result.status ?? 1);
