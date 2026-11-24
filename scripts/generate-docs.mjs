import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "..");
const docsDir = path.join(rootDir, "docs");
const outputFilePath = path.join(rootDir, "src", "lib", "docs-generated.ts");

const files = [
  "COOKIE_POLICY.md",
  "PRIVACY_POLICY.md",
  "TERMS_OF_SERVICE.md",
];

const FORBIDDEN_LEGACY_PATTERNS = [
  /supabase/i,
  /resend/i,
  /upstash/i,
  /erasure_queue/i,
  /erasure_audit_log/i,
  /review_tokens/i,
  /clan_shops/i,
  /kebab_shops/i,
  /\/api\/report-content/i,
  /DSA\s+Notice/i,
  /™/,
  /kebapps\.it/i,
];

// Wrap tables in a scrollable container so wide tables scroll horizontally
// within the card instead of overflowing the page edges.
function wrapTables(html) {
  return html
    .replace(/<table>/g, '<div class="legal-table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
}

function sanitizeHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<\/?(?:form|input|textarea|select|button)\b[^>]*>/gi, "")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(?:javascript|vbscript):[^"'\s>]*/gi, "");
}

let outputContent = "// THIS FILE IS AUTO-GENERATED. DO NOT EDIT DIRECTLY.\n\n";

for (const file of files) {
  const filePath = path.join(docsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] Required legal markdown file missing: ${filePath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const pattern of FORBIDDEN_LEGACY_PATTERNS) {
    if (pattern.test(content)) {
      console.error(
        `[ERROR] Obsolete legacy reference (${pattern}) found in active legal document: ${filePath}`
      );
      process.exit(1);
    }
  }
  const rawHtml = marked.parse(content);
  const sanitizedHtml = wrapTables(sanitizeHtml(rawHtml));
  const varName = file.replace(".md", "");
  outputContent += `export const ${varName} = ${JSON.stringify(sanitizedHtml)};\n\n`;
}

fs.writeFileSync(outputFilePath, outputContent, "utf8");
console.log(`Generated ${outputFilePath} with sanitized HTML content`);
