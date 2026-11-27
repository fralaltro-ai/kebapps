interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

const CLOUDFLARE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
const CLOUDFLARE_TEST_SECRET_KEYS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

export interface ValidateTurnstileOptions {
  secretKey?: string;
  secretEnvName?: string;
}

/**
 * Validates a Cloudflare Turnstile token securely on the server-side.
 * This prevents bots and automated scripts from bypassing frontend validation.
 *
 * @param token The turnstile token received from the client-side component.
 * @param ip Optional: The IP address of the user (recommended for better validation).
 * @param expectedAction Optional: The specific action name expected for this token.
 * @param options Optional: Override secret key and env var name for dedicated widgets.
 * @returns A boolean indicating whether the token is valid.
 */
export async function validateTurnstileToken(
  token: string,
  ip?: string,
  expectedAction?: string,
  options?: ValidateTurnstileOptions
): Promise<boolean> {
  const secretEnvName = options?.secretEnvName ?? "TURNSTILE_SECRET_KEY";
  const secret =
    options && "secretKey" in options
      ? options.secretKey
      : process.env.TURNSTILE_SECRET_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      throw new Error(`${secretEnvName} is required in production environment.`);
    }
    console.warn(`${secretEnvName} is not defined in the environment. Bypassing validation (NOT FOR PRODUCTION).`);
    return true; // Bypass in dev if no secret is provided, but log a warning
  }

  if (isProd && CLOUDFLARE_TEST_SECRET_KEYS.has(secret)) {
    console.error(`Cloudflare Turnstile test secret key (${secretEnvName}) is forbidden in production.`);
    return false;
  }

  if (!token) {
    return false;
  }

  // Allow local zero-cost / offline development bypass only outside production
  // when using the official Cloudflare dummy test secret key.
  if (!isProd && secret === CLOUDFLARE_TEST_SECRET_KEY && token === "dev-turnstile-bypass") {
    return true;
  }

  try {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);
    if (ip) {
      formData.append("remoteip", ip);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      // Never let a hanging siteverify call block the request indefinitely
      // (Workers invocation limit). The catch below already fails closed on abort.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(`Turnstile siteverify returned HTTP ${res.status}`);
      return false;
    }

    const data = (await res.json()) as TurnstileResponse;

    if (!data.success) {
      console.error("Turnstile validation failed:", data["error-codes"]);
      return false;
    }

    // Validate action if expectedAction is provided (SEC-BOT-12: fail-closed —
    // a missing/empty data.action must NOT silently bypass the check in real widgets;
    // official Cloudflare dummy test keys omit action when siteverify returns success).
    const isDevTestSecret = !isProd && secret === CLOUDFLARE_TEST_SECRET_KEY;
    if (expectedAction && !(isDevTestSecret && !data.action)) {
      if (!data.action || data.action !== expectedAction) {
        console.error(`Turnstile action mismatch: expected '${expectedAction}', received '${data.action || "<none>"}'`);
        return false;
      }
    }

    // In production, validate hostname against allowlist. A missing hostname
    // in production is rejected rather than skipped.
    if (isProd) {
      const allowedHosts = [
        "kebapps.app",
        "www.kebapps.app",
        "staging.kebapps.app",
      ];
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (siteUrl) {
        try {
          allowedHosts.push(new URL(siteUrl).hostname);
        } catch {
          // ignore
        }
      }
      if (!data.hostname || !allowedHosts.includes(data.hostname)) {
        console.error(`Turnstile hostname rejected: '${data.hostname || "<none>"}' not in allowed hosts.`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error connecting to Turnstile API:", error);
    return false;
  }
}
