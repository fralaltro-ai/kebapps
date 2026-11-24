/**
 * Centralized Cost Guard & Emergency Kill Switch for Paid APIs (SEC-BOT-07)
 * 
 * Supports both runtime environment variables (DISABLE_PAID_APIS via Cloudflare Worker secrets)
 * and build-time flags (NEXT_PUBLIC_DISABLE_PAID_APIS).
 */
export function paidApisDisabled(): boolean {
  return process.env.DISABLE_PAID_APIS === "1" || process.env.NEXT_PUBLIC_DISABLE_PAID_APIS === "1";
}
