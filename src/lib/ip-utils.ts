import { headers } from "next/headers";

/**
 * Extracts the client IP address for rate-limiting and Turnstile remoteip.
 * Prioritizes Cloudflare's verified cf-connecting-ip header (authoritative when
 * proxied by Cloudflare), falling back to x-real-ip / x-forwarded-for — which
 * are client-controllable and only used as a best-effort key, not a trust
 * boundary, when a request reaches the app without passing through Cloudflare.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();

    // 1. Cloudflare connecting IP (Authoritative when proxied by Cloudflare)
    const cfConnectingIp = headerList.get("cf-connecting-ip");
    if (cfConnectingIp) return cfConnectingIp;

    // 2. Real IP / Forwarded For
    const xRealIp = headerList.get("x-real-ip");
    if (xRealIp) return xRealIp;

    const xForwardedFor = headerList.get("x-forwarded-for");
    if (xForwardedFor) {
      return xForwardedFor.split(",")[0].trim();
    }

    return "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}
