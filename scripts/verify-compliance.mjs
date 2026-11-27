#!/usr/bin/env node
/**
 * KebApps Local — Repository Compliance Self-Check (`--repo-only`)
 *
 * Verifies automatically:
 *  1. Absence of legacy Supabase / Upstash / Resend / Web-Push / Auth dependencies and directories.
 *  2. Absence of legacy imports or secrets in `src/`.
 *  3. Only stateless, read-only GET API proxies exist (zero Server Actions, zero PII/GPS persistence).
 *  4. Strict Zero-Cost Google Places FieldMask compliance (no Enterprise/Atmosphere SKUs).
 *  5. Ephemeral client map_cache TTL <= 24h and exclusion from Backup JSON export.
 *  6. Presence of MapConsentGate and GoogleAttribution on map/shop surfaces.
 *  7. Alignment of legal/technical docs and compiled docs bundle (`src/lib/docs-generated.ts`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
if (args.length > 0 && !args.includes("--repo-only")) {
  console.error(`Unsupported arguments: ${args.join(" ")}. Only --repo-only is supported in local-first architecture.`);
  process.exit(1);
}

const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
}

function walkFiles(dir, { excludeDirs = new Set(), excludeFiles = new Set() } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludeDirs.has(entry.name)) {
        out.push(...walkFiles(full, { excludeDirs, excludeFiles }));
      }
    } else if (!excludeFiles.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function readUtf8(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

// 1. no_legacy_dependencies
(() => {
  const pkg = JSON.parse(readUtf8("package.json"));
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const forbiddenDeps = [
    "@supabase/supabase-js",
    "@supabase/ssr",
    "@supabase/auth-js",
    "@upstash/ratelimit",
    "@upstash/redis",
    "@vercel/kv",
    "resend",
    "web-push",
    "jose",
    "jsonwebtoken",
  ];
  const presentDeps = forbiddenDeps.filter((d) =>
    Object.keys(allDeps).some((k) => k === d || k.startsWith("@supabase/"))
  );
  const forbiddenDirs = ["supabase", "worker/cron", "src/lib/email"].filter((d) =>
    fs.existsSync(path.join(ROOT, d))
  );

  if (presentDeps.length > 0 || forbiddenDirs.length > 0) {
    record(
      "no_legacy_dependencies",
      false,
      `Found legacy deps=[${presentDeps.join(", ")}] dirs=[${forbiddenDirs.join(", ")}]`
    );
  } else {
    record("no_legacy_dependencies", true, "No legacy DB/Redis/Push/Auth deps or dirs");
  }
})();

// 2. no_legacy_imports_in_src
(() => {
  const srcFiles = walkFiles(path.join(ROOT, "src"), {
    excludeFiles: new Set(["docs-generated.ts"]),
  });
  const forbiddenPatterns = [
    /@supabase/i,
    /@upstash/i,
    /@vercel\/kv/i,
    /\bresend\b/i,
    /\bweb-push\b/i,
    /SUPABASE_SERVICE_ROLE_KEY/,
    /NEXT_PUBLIC_SUPABASE_URL/,
    /\bCRON_SECRET\b/,
    /\bERASURE_SALT\b/,
    /\bCHECKIN_JWT_SECRET\b/,
    /\bDELETION_JWT_SECRET\b/,
  ];
  const hits = [];
  for (const absPath of srcFiles) {
    const rel = path.relative(ROOT, absPath);
    const content = fs.readFileSync(absPath, "utf8");
    for (const pat of forbiddenPatterns) {
      if (pat.test(content)) {
        hits.push(`${rel} (${pat})`);
      }
    }
  }
  if (hits.length > 0) {
    record("no_legacy_imports_in_src", false, `Legacy references in src: ${hits.join("; ")}`);
  } else {
    record("no_legacy_imports_in_src", true, "Zero legacy imports or secrets in src/");
  }
})();

// 3. stateless_readonly_api_proxies
(() => {
  const apiDir = path.join(ROOT, "src", "app", "api");
  const apiFiles = walkFiles(apiDir).map((p) => path.relative(ROOT, p)).sort();
  const expectedApiFiles = [
    "src/app/api/geocode-search/route.ts",
    "src/app/api/shops/route.ts",
    "src/app/api/support-contact/route.ts",
  ];
  const issues = [];

  if (JSON.stringify(apiFiles) !== JSON.stringify(expectedApiFiles)) {
    issues.push(`Unexpected API files: [${apiFiles.join(", ")}]`);
  }

  for (const rel of apiFiles) {
    const content = readUtf8(rel);
    if (/\bexport\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/.test(content)) {
      issues.push(`${rel} exports a mutating HTTP handler`);
    }
    if (!/\bexport\s+(?:async\s+)?function\s+GET\b/.test(content)) {
      issues.push(`${rel} missing GET handler`);
    }
    if (!/validateTurnstileToken/.test(content)) {
      issues.push(`${rel} missing validateTurnstileToken check`);
    }
  }

  const allSrcFiles = walkFiles(path.join(ROOT, "src"));
  for (const absPath of allSrcFiles) {
    const rel = path.relative(ROOT, absPath);
    const content = fs.readFileSync(absPath, "utf8");
    if (/^\s*["']use server["']/m.test(content)) {
      issues.push(`${rel} contains "use server" directive`);
    }
  }

  if (issues.length > 0) {
    record("stateless_readonly_api_proxies", false, issues.join("; "));
  } else {
    record(
      "stateless_readonly_api_proxies",
      true,
      "3 GET-only Turnstile-protected proxies, zero Server Actions"
    );
  }
})();

// 4. google_places_fieldmask_basic_only
(() => {
  const checkedFiles = [
    "src/lib/map-proxy-config.ts",
    "src/app/api/shops/route.ts",
  ];
  const forbiddenSkus = [
    "reviews",
    "photos",
    "rating",
    "userRatingCount",
    "currentOpeningHours",
    "regularOpeningHours",
    "priceLevel",
    "editorialSummary",
    "websiteUri",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    // Google Maps Platform EEA Terms ("No Use With any Map"): Places API
    // content other than latitude, longitude, and place_id must not be returned.
    "displayName",
    "formattedAddress",
    "addressComponents",
    "types",
    "primaryType",
  ];

  const issues = [];
  for (const rel of checkedFiles) {
    const content = readUtf8(rel);
    if (rel.startsWith("src/app/api/shops/") && !content.includes("X-Goog-FieldMask")) {
      issues.push(`${rel} missing X-Goog-FieldMask header`);
    }
    const maskMatches = content.match(/(?:PLACES_BASIC_FIELD_MASK\s*=\s*["']([^"']+)["']|"X-Goog-FieldMask"\s*:\s*([^,\n}]+))/g) || [];
    const maskJoined = maskMatches.join(" ");
    for (const sku of forbiddenSkus) {
      if (new RegExp(`\\b${sku}\\b`, "i").test(maskJoined)) {
        issues.push(`${rel} requests Enterprise/Atmosphere field '${sku}'`);
      }
    }
  }

  if (issues.length > 0) {
    record("google_places_fieldmask_basic_only", false, issues.join("; "));
  } else {
    record(
      "google_places_fieldmask_basic_only",
      true,
      "X-Goog-FieldMask restricted strictly to Basic SKU fields"
    );
  }
})();

// 5. ephemeral_map_cache_and_backup_isolation
(() => {
  const schemaSrc = readUtf8("src/lib/local-storage/schema.ts");
  const backupSrc = readUtf8("src/lib/local-storage/backup.ts");
  const issues = [];

  const ttlMatch = schemaSrc.match(/export\s+const\s+MAP_CACHE_TTL_MS\s*=\s*([^;]+);/);
  if (!ttlMatch) {
    issues.push("MAP_CACHE_TTL_MS constant not found");
  } else {
    const expr = ttlMatch[1].replace(/\/\/.*$/, "").trim();
    if (!/^24\s*\*\s*60\s*\*\s*60\s*\*\s*1000$|^86_?400_?000$/.test(expr)) {
      issues.push(`MAP_CACHE_TTL_MS exceeds or diverges from 24h cap: ${expr}`);
    }
  }

  const backupObjMatch = backupSrc.match(/data:\s*\{([\s\S]*?)\}\s*,\s*\}\s*\)/);
  if (backupObjMatch && /map_?cache/i.test(backupObjMatch[1])) {
    issues.push("exportBackupData includes map_cache");
  }

  const backupSchemaMatch = schemaSrc.match(/BackupBundleSchema\s*=[\s\S]*?data:\s*z\.object\(\{([\s\S]*?)\}\)/);
  if (backupSchemaMatch && /map_?cache/i.test(backupSchemaMatch[1])) {
    issues.push("BackupBundleSchema includes map_cache");
  }

  const mapCacheSchemaMatch = schemaSrc.match(/MapCacheEntrySchema\s*=[\s\S]*?z\.object\(\{([\s\S]*?)\}\)/);
  if (mapCacheSchemaMatch) {
    const body = mapCacheSchemaMatch[1];
    for (const forbiddenField of ["name:", "address:", "city:", "region:", "country:"]) {
      if (body.includes(forbiddenField)) {
        issues.push(`MapCacheEntrySchema must not persist Google text field '${forbiddenField}'`);
      }
    }
  }

  if (!schemaSrc.includes("GOOGLE_COORDS_TTL_MS") || !backupSrc.includes("coords_expires_at")) {
    issues.push("30-day coordinate expiry / backup exclusion guard missing");
  }

  if (issues.length > 0) {
    record("ephemeral_map_cache_and_backup_isolation", false, issues.join("; "));
  } else {
    record(
      "ephemeral_map_cache_and_backup_isolation",
      true,
      "map_cache TTL <= 24h and excluded from JSON backups"
    );
  }
})();

// 6. map_consent_gate_and_google_attribution
(() => {
  const issues = [];
  const mapPage = readUtf8("src/app/map/page.tsx");
  const shopInfoCard = readUtf8("src/components/map/ShopInfoCard.tsx");
  const unverifiedCard = readUtf8("src/components/map/UnverifiedShopCard.tsx");
  const routingPanel = readUtf8("src/components/map/RoutingPanel.tsx");
  const zeroCostMap = readUtf8("src/components/map/ZeroCostLocalMapView.tsx");
  const attribution = readUtf8("src/components/ui/GoogleAttribution.tsx");

  if (!mapPage.includes("<MapConsentGate>")) {
    issues.push("src/app/map/page.tsx missing <MapConsentGate>");
  }
  if (!shopInfoCard.includes("<GoogleAttribution")) {
    issues.push("src/components/map/ShopInfoCard.tsx missing <GoogleAttribution />");
  }
  if (!unverifiedCard.includes("<GoogleAttribution")) {
    issues.push("src/components/map/UnverifiedShopCard.tsx missing <GoogleAttribution />");
  }
  if (!routingPanel.includes("<GoogleAttribution")) {
    issues.push("src/components/map/RoutingPanel.tsx missing <GoogleAttribution />");
  }
  if (zeroCostMap.includes("<GoogleAttribution")) {
    issues.push("src/components/map/ZeroCostLocalMapView.tsx must not display <GoogleAttribution /> in non-Google demo mode");
  }
  if (!attribution.includes("google_on_white.png") || !attribution.includes("google_on_dark.png")) {
    issues.push("src/components/ui/GoogleAttribution.tsx must render official google_on_white.png and google_on_dark.png assets");
  }

  if (issues.length > 0) {
    record("map_consent_gate_and_google_attribution", false, issues.join("; "));
  } else {
    record(
      "map_consent_gate_and_google_attribution",
      true,
      "MapConsentGate and official GoogleAttribution verified on map cards without demo watermark"
    );
  }
})();

// 7. legal_and_technical_docs_aligned
(() => {
  const issues = [];
  const requiredDocs = [
    "docs/PRIVACY_POLICY.md",
    "docs/COOKIE_POLICY.md",
    "docs/TERMS_OF_SERVICE.md",
  ];
  for (const docPath of requiredDocs) {
    if (!fs.existsSync(path.join(ROOT, docPath))) {
      issues.push(`Missing required legal doc: ${docPath}`);
    }
  }

  const generatedPath = "src/lib/docs-generated.ts";
  if (!fs.existsSync(path.join(ROOT, generatedPath))) {
    issues.push(`Missing compiled docs bundle: ${generatedPath}`);
  } else {
    const gen = readUtf8(generatedPath);
    for (const key of ["COOKIE_POLICY", "PRIVACY_POLICY", "TERMS_OF_SERVICE"]) {
      if (!gen.includes(`export const ${key} =`)) {
        issues.push(`${generatedPath} missing export ${key}`);
      }
    }
  }

  const legalPages = [
    "src/app/privacy-policy/page.tsx",
    "src/app/cookie-policy/page.tsx",
    "src/app/terms/page.tsx",
  ];
  for (const pagePath of legalPages) {
    const src = readUtf8(pagePath);
    if (!src.includes("LegalContent") || !src.includes("@/lib/docs-generated")) {
      issues.push(`${pagePath} does not render compiled docs via LegalContent`);
    }
  }

  const docFiles = [
    ...walkFiles(path.join(ROOT, "docs")).filter((p) => p.endsWith(".md")),
    path.join(ROOT, "README.md"),
    path.join(ROOT, "GEMINI.md"),
    path.join(ROOT, "CLAUDE.md"),
    path.join(ROOT, "DESIGN.md"),
    path.join(ROOT, "src/lib/docs-generated.ts"),
  ];

  const legacyDocPatterns = [
    /\bsupabase\b/i,
    /\bupstash\b/i,
    /\bresend\b/i,
    /\berasure_queue\b/i,
    /\berasure_audit_log\b/i,
    /\breview_tokens\b/i,
    /\bclan_shops\b/i,
    /\bkebab_shops\b/i,
    /\/api\/report-content\b/i,
    /\bDSA_NOTICE\b/i,
    /™/,
    /kebapps\.it/i,
  ];

  for (const absPath of docFiles) {
    if (!fs.existsSync(absPath)) continue;
    const rel = path.relative(ROOT, absPath);
    const content = fs.readFileSync(absPath, "utf8");
    for (const pat of legacyDocPatterns) {
      if (pat.test(content)) {
        issues.push(`${rel} contains obsolete legacy reference (${pat})`);
      }
    }
  }

  // Open-source & brand/domain hygiene checks
  for (const ossFile of ["LICENSE", "THIRD_PARTY_NOTICES.md", "SECURITY.md", "CONTRIBUTING.md", ".env.example", "public/_headers"]) {
    if (!fs.existsSync(path.join(ROOT, ossFile))) {
      issues.push(`Missing open-source / security release file: ${ossFile}`);
    }
  }
  const thirdPartyNotices = fs.existsSync(path.join(ROOT, "THIRD_PARTY_NOTICES.md"))
    ? readUtf8("THIRD_PARTY_NOTICES.md")
    : "";
  if (!thirdPartyNotices.includes("SIL OPEN FONT LICENSE Version 1.1")) {
    issues.push("THIRD_PARTY_NOTICES.md missing SIL OPEN FONT LICENSE Version 1.1 text");
  }
  if (fs.existsSync(path.join(ROOT, "docs/REPORT_RISCHI_PROPRIETARIO.md"))) {
    issues.push("Internal audit document docs/REPORT_RISCHI_PROPRIETARIO.md must not exist in public repo");
  }

  const brandCheckedFiles = [
    ...walkFiles(path.join(ROOT, "src")),
    path.join(ROOT, "public/logo.svg"),
    path.join(ROOT, "docs/logo.svg"),
    path.join(ROOT, ".env.example"),
    path.join(ROOT, "CHANGELOG.md"),
  ];
  for (const absPath of brandCheckedFiles) {
    if (!fs.existsSync(absPath)) continue;
    const rel = path.relative(ROOT, absPath);
    const content = fs.readFileSync(absPath, "utf8");
    if (/™/.test(content)) {
      issues.push(`${rel} contains forbidden trademark symbol ™`);
    }
    if (/kebapps\.it/i.test(content)) {
      issues.push(`${rel} contains obsolete domain/email kebapps.it`);
    }
  }

  if (issues.length > 0) {
    record("legal_and_technical_docs_aligned", false, issues.join("; "));
  } else {
    record(
      "legal_and_technical_docs_aligned",
      true,
      "All active docs, legal pages, and docs-generated.ts are aligned with zero legacy drift"
    );
  }
})();

// 8. consent_and_transparency_guards
(() => {
  const issues = [];
  const compassSrc = readUtf8("src/hooks/useCompass.ts");
  const layoutSrc = readUtf8("src/app/layout.tsx");
  const nextConfigSrc = readUtf8("next.config.mjs");

  if (!compassSrc.includes("hasGpsConsent")) {
    issues.push("src/hooks/useCompass.ts must gate deviceorientation sensors on explicit GPS consent");
  }
  if (!layoutSrc.includes("AppFooter")) {
    issues.push("src/app/layout.tsx must mount <AppFooter /> with legal policy links");
  }
  if (!nextConfigSrc.includes("!sameOrigin")) {
    issues.push("next.config.mjs must isolate cross-origin requests as NetworkOnly in Workbox");
  }
  for (const pagePath of [
    "src/app/privacy-policy/page.tsx",
    "src/app/cookie-policy/page.tsx",
    "src/app/terms/page.tsx",
  ]) {
    if (!readUtf8(pagePath).includes("ControllerIdentityNotice")) {
      issues.push(`${pagePath} missing <ControllerIdentityNotice />`);
    }
  }
  for (const supportSurface of [
    "src/components/profile/ProfileInfoSection.tsx",
    "src/components/legal/ControllerIdentityNotice.tsx",
  ]) {
    const src = readUtf8(supportSurface);
    if (!src.includes("SupportEmailGate")) {
      issues.push(`${supportSurface} missing <SupportEmailGate /> anti-bot guard`);
    }
    if (/mailto:|NEXT_PUBLIC_SUPPORT_EMAIL/.test(src)) {
      issues.push(`${supportSurface} exposes static mailto: or NEXT_PUBLIC_SUPPORT_EMAIL`);
    }
  }

  if (issues.length > 0) {
    record("consent_and_transparency_guards", false, issues.join("; "));
  } else {
    record(
      "consent_and_transparency_guards",
      true,
      "Compass consent gate, AppFooter, cross-origin SW NetworkOnly, ControllerIdentityNotice, and SupportEmailGate verified"
    );
  }
})();

let failed = false;
console.log("\nKebApps Local — Compliance Verification (--repo-only)\n");
for (const r of results) {
  const icon = r.ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${r.id}: ${r.detail}`);
  if (!r.ok) failed = true;
}
console.log("");

if (failed) {
  process.exit(1);
}
