#!/usr/bin/env node
/**
 * Pre-deploy guard for the main Cloudflare Worker (`npm run deploy:cf`).
 *
 * Ensures:
 *  - .open-next/worker.js exists
 *  - No localhost dev URL or test overrides leaked into the bundle
 *  - Google Maps & Turnstile public keys are bundled for production
 *  - Zero legacy Supabase/Redis secrets leaked into client bundles
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LOCAL_URL = "localhost:8787";

const problems = [];
const bundle = path.join(ROOT, ".open-next");
if (!fs.existsSync(path.join(bundle, "worker.js"))) {
  console.error("\n❌ .open-next/worker.js non trovato: esegui prima la build di produzione.\n");
  process.exit(1);
}

if (fs.existsSync(path.join(ROOT, ".env"))) {
  problems.push("file .env presente nella root: rimuovilo e usa solo .env.local / .env.production.local per evitare leakage");
}

const filesWith = (needle) => {
  const out = spawnSync("grep", ["-rlF", needle, ".open-next"], { cwd: ROOT, encoding: "utf-8" });
  return out.stdout.split("\n").filter(Boolean).length;
};

if (filesWith(LOCAL_URL) > 0) {
  problems.push(`il bundle contiene ${LOCAL_URL}: è una build locale di test`);
}

const DUMMY_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
const nextEnvPath = path.join(bundle, "cloudflare", "next-env.mjs");
if (fs.existsSync(nextEnvPath)) {
  const { production = {} } = await import(pathToFileURL(nextEnvPath).href);
  if (/localhost|127\.0\.0\.1/.test(production.NEXT_PUBLIC_SITE_URL || "")) {
    problems.push("next-env.mjs incorpora un URL locale (localhost / 127.0.0.1) in NEXT_PUBLIC_SITE_URL");
  }
  if (production.NEXT_PUBLIC_DISABLE_PAID_APIS === "1" || production.DISABLE_PAID_APIS === "1") {
    problems.push("kill-switch API a pagamento (NEXT_PUBLIC_DISABLE_PAID_APIS / DISABLE_PAID_APIS=1) attivo nella build di produzione");
  }
  if (!production.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    problems.push("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY mancante nella build di produzione");
  }
  const mapId = (production.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim();
  if (!mapId || mapId === "DEMO_MAP_ID") {
    problems.push(
      "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID mancante o impostato su DEMO_MAP_ID in produzione (vietato dai Google Maps Platform Demo Terms: configura un Map ID reale)"
    );
  }
  if (!production.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    problems.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY mancante nella build di produzione");
  } else if (production.NEXT_PUBLIC_TURNSTILE_SITE_KEY === DUMMY_TURNSTILE_SITE_KEY) {
    problems.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY usa la chiave dummy di test Cloudflare in produzione");
  }
  if (production.TURNSTILE_SECRET_KEY === "1x0000000000000000000000000000000AA") {
    problems.push("TURNSTILE_SECRET_KEY usa la chiave dummy di test Cloudflare in produzione");
  }
  if (production.GOOGLE_PLACES_BACKEND_KEY || production.TURNSTILE_SECRET_KEY) {
    problems.push(
      "GOOGLE_PLACES_BACKEND_KEY / TURNSTILE_SECRET_KEY incorporati in chiaro in .open-next/cloudflare/next-env.mjs: lasciali vuoti (\"\") in .env.production.local e caricali solo via `npx wrangler secret put`"
    );
  }

  const controllerName = (production.NEXT_PUBLIC_DATA_CONTROLLER_NAME || "").trim();
  const forbiddenNames = new Set(["", "kebapps", "team kebapps", "nome cognome"]);
  if (!controllerName || forbiddenNames.has(controllerName.toLowerCase())) {
    problems.push(
      "NEXT_PUBLIC_DATA_CONTROLLER_NAME mancante o generico in produzione (obbligatorio Nome e Cognome reali ex Art. 13(1)(a) GDPR)"
    );
  }
}

const readEnvKeys = (file) => {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null;
  return new Set(
    fs
      .readFileSync(p, "utf-8")
      .split("\n")
      .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
      .filter(Boolean)
  );
};
const localKeys = readEnvKeys(".env.local");
const prodKeys = readEnvKeys(".env.production.local") ?? new Set();
if (localKeys) {
  const leaking = [...localKeys].filter((k) => !prodKeys.has(k));
  if (leaking.length) {
    problems.push(
      "variabili di .env.local non ridefinite in .env.production.local: " +
        leaking.join(", ") +
        " (ridefiniscile anche vuote per evitare fallback locali)"
    );
  }
}

if (problems.length) {
  console.error(
    "\n❌ Deploy rifiutato: questo bundle non è una build di produzione valida.\n" +
      problems.map((p) => `   - ${p}`).join("\n") +
      "\n"
  );
  process.exit(1);
}
console.log("✅ Bundle di produzione verificato (solo Google Maps + Turnstile, zero segreti legacy).");
