import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip-utils";
import { checkRateLimitFallback } from "@/lib/rate-limit-fallback";
import { validateTurnstileToken } from "@/lib/turnstile";
import { serverError } from "@/lib/server-errors";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

const SUPPORT_SUBJECT = "[KebApps] Supporto / Segnalazione";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Stateless Support Contact Proxy — Server-Side Zero-DB
 *
 * Reveals the support email address only after validating a dedicated
 * Cloudflare Turnstile (Managed) token + per-isolate IP rate limiting.
 * Keeps SUPPORT_EMAIL out of client bundles, static HTML, and docs.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = await getClientIp();
    const allowed = checkRateLimitFallback("ratelimit_support_contact", ip, 5, 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Troppe richieste di verifica. Riprova tra un minuto." },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const turnstileToken =
      request.headers.get("x-turnstile-token") ||
      request.nextUrl.searchParams.get("turnstileToken");

    const valid =
      Boolean(turnstileToken) &&
      (await validateTurnstileToken(turnstileToken!, ip, "support_contact", {
        secretKey: process.env.TURNSTILE_SUPPORT_SECRET_KEY,
        secretEnvName: "TURNSTILE_SUPPORT_SECRET_KEY",
      }));

    if (!valid) {
      return NextResponse.json(
        { error: "Verifica anti-bot fallita." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const isProd = process.env.NODE_ENV === "production";
    const configuredEmail = (process.env.SUPPORT_EMAIL || "").trim();

    if (configuredEmail && EMAIL_REGEX.test(configuredEmail)) {
      return NextResponse.json(
        {
          email: configuredEmail,
          subject: SUPPORT_SUBJECT,
          source: "live",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    if (isProd) {
      console.error("[Support Contact] SUPPORT_EMAIL is missing or invalid in production.");
      return NextResponse.json(
        { error: "Canale di supporto temporaneamente non configurato." },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const legacyEnvEmail = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "").trim();
    const fallbackEmail = EMAIL_REGEX.test(legacyEnvEmail)
      ? legacyEnvEmail
      : "support@kebapps.app";

    return NextResponse.json(
      {
        email: fallbackEmail,
        subject: SUPPORT_SUBJECT,
        source: "dev_fallback",
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const res = serverError("Support Contact", error);
    res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return res;
  }
}
