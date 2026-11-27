"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseTurnstileOptions {
  /**
   * Action name bound into the token at mint time (Turnstile `action` param).
   * Must match the `expectedAction` passed server-side to validateTurnstileToken
   * for the check to mean anything (SEC-BOT-12) — required so no call site forgets it.
   */
  action: string;
  /** Optional site key override for dedicated widgets (defaults to NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  siteKey?: string;
  size?: "normal" | "compact" | "flexible" | "invisible";
  theme?: "auto" | "light" | "dark";
  /** "render" (default): widget auto-executes on mount/reset. "execute": waits for execute(). */
  execution?: "render" | "execute";
  appearance?: "always" | "execute" | "interaction-only";
  /** Called with the token on every successful verification (mainly for "render" mode). */
  onVerify?: (token: string) => void;
  /** Called when an interactive ("render"-mode) token expires before submission. */
  onExpire?: () => void;
  /** Called once the original attempt AND the transparent retry have both failed. */
  onError?: (message: string) => void;
  /** Ms to wait for a response before treating an execute() call as failed (default 15s). */
  timeoutMs?: number;
}

/** Max ms execute() waits for the script/container to become ready before rejecting. */
const READY_WAIT_MS = 5000;

const TURNSTILE_SCRIPT_ATTR = "data-kebapp-turnstile";
let turnstileScriptPromise: Promise<boolean> | null = null;

/**
 * COMP-AUDIT-D2: loads the Turnstile script on demand, the first time any widget on the
 * page actually mounts, instead of unconditionally in the root layout on every route.
 * Idempotent and safe across concurrently-mounting widgets (module-level singleton
 * promise, and a marker attribute so a second hook instance finds the same <script> tag
 * rather than injecting a duplicate). Clears cache and tag on load failure so retry works.
 */
function ensureTurnstileScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${TURNSTILE_SCRIPT_ATTR}]`);
    if (existing) {
      if (window.turnstile) {
        resolve(true);
      } else {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => {
          existing.remove();
          turnstileScriptPromise = null;
          resolve(false);
        }, { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.setAttribute(TURNSTILE_SCRIPT_ATTR, "1");
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => {
      script.remove();
      turnstileScriptPromise = null;
      resolve(false);
    }, { once: true });
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

/**
 * Shared Cloudflare Turnstile lifecycle hook (invisible and managed/visible modes).
 *
 * Consolidates the render/execute/reset plumbing that previously existed in
 * hand-rolled forms. Registers error-callback / expired-callback / timeout-callback
 * — and does one transparent reset+retry before surfacing a failure, so a flaky
 * challenge does not require the user to notice and manually retry.
 *
 * `containerRef` is a callback ref: the widget is rendered whenever the
 * container element mounts (including late/conditional mounts such as modals or
 * views gated behind a loading state) and removed when it unmounts.
 */
export function useTurnstile({
  action,
  siteKey,
  size = "invisible",
  theme = "auto",
  execution = "render",
  appearance,
  onVerify,
  onExpire,
  onError,
  timeoutMs = 15000,
}: UseTurnstileOptions) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => setContainer(node), []);
  const resolvedSiteKey = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const widgetIdRef = useRef<string | null>(null);
  const resolverRef = useRef<((token: string) => void) | null>(null);
  const rejecterRef = useRef<((err: Error) => void) | null>(null);
  const retriedRef = useRef(false);
  const hasExecutedRef = useRef(false);
  const inFlightRef = useRef<Promise<string> | null>(null);
  const retryGuardRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest callbacks without forcing the render effect to re-run.
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  const clearRetryGuard = useCallback(() => {
    if (retryGuardRef.current) {
      clearTimeout(retryGuardRef.current);
      retryGuardRef.current = null;
    }
  }, []);

  const handleFailure = useCallback((reason: string, opts?: { expired?: boolean }) => {
    clearRetryGuard();
    // Idle expiration/error with no active execute() caller in "execute" mode:
    // reset widget quietly without minting in background.
    if (execution === "execute" && !rejecterRef.current) {
      hasExecutedRef.current = false;
      retriedRef.current = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // widget already removed or detached
        }
      }
      return;
    }

    if (execution === "render" && opts?.expired) {
      hasExecutedRef.current = false;
      retriedRef.current = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // widget already removed or detached
        }
      }
      onExpireRef.current?.();
      return;
    }

    if (!retriedRef.current && widgetIdRef.current && window.turnstile) {
      retriedRef.current = true;
      try {
        window.turnstile.reset(widgetIdRef.current);
        if (execution === "execute") {
          window.turnstile.execute(widgetIdRef.current);
          // Guard the retry itself: if it never calls back, fail hard instead of
          // leaving a pending promise hanging. Cleared on success, on settle and
          // on the next execute(), so it can never fire into a later attempt.
          retryGuardRef.current = setTimeout(() => {
            retryGuardRef.current = null;
            if (rejecterRef.current) {
              handleFailure("Turnstile: la verifica anti-bot non ha risposto dopo il retry.");
            }
          }, timeoutMs);
        }
        return;
      } catch {
        // fall through to hard failure below
      }
    }

    if (rejecterRef.current) {
      const reject = rejecterRef.current;
      resolverRef.current = null;
      rejecterRef.current = null;
      reject(new Error(reason));
    }
    onErrorRef.current?.(reason);
  }, [execution, timeoutMs, clearRetryGuard]);

  useEffect(() => {
    if (!container) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const renderWidget = (): boolean => {
      if (!window.turnstile) return false;
      try {
        hasExecutedRef.current = false;
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: resolvedSiteKey,
          action,
          size,
          theme,
          execution,
          ...(appearance ? { appearance } : {}),
          "refresh-expired": "auto",
          callback: (token: string) => {
            hasExecutedRef.current = true;
            retriedRef.current = false;
            clearRetryGuard();
            onVerifyRef.current?.(token);
            if (resolverRef.current) {
              const resolve = resolverRef.current;
              resolverRef.current = null;
              rejecterRef.current = null;
              resolve(token);
            }
          },
          "error-callback": () => handleFailure("Verifica anti-bot fallita (errore Turnstile)."),
          "expired-callback": () => handleFailure("Verifica anti-bot scaduta.", { expired: true }),
          "timeout-callback": () => handleFailure("Verifica anti-bot: timeout della challenge."),
        });
      } catch (err) {
        console.error("Error rendering Turnstile:", err);
        if (execution === "render") {
          onErrorRef.current?.("Impossibile inizializzare il controllo anti-bot.");
        }
      }
      // Script is present: stop polling whether or not render succeeded, a
      // render exception will not resolve itself by retrying every 500ms.
      return true;
    };

    void ensureTurnstileScript().then((loaded) => {
      if (cancelled) return;
      if (!loaded && !window.turnstile) {
        if (execution === "render") {
          onErrorRef.current?.("Impossibile caricare la verifica anti-bot Cloudflare Turnstile.");
        }
        return;
      }
      if (!renderWidget()) {
        // Script loaded but window.turnstile not yet initialized: poll briefly within timeoutMs.
        const pollStartedAt = Date.now();
        interval = setInterval(() => {
          if (cancelled) {
            clearInterval(interval);
            return;
          }
          if (renderWidget()) {
            clearInterval(interval);
            return;
          }
          if (execution === "render" && Date.now() - pollStartedAt >= timeoutMs) {
            clearInterval(interval);
            onErrorRef.current?.("Verifica anti-bot non disponibile o bloccata dal browser.");
          }
        }, 500);
      }
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      clearRetryGuard();
      if (rejecterRef.current) {
        const reject = rejecterRef.current;
        resolverRef.current = null;
        rejecterRef.current = null;
        reject(new Error("Turnstile widget unmounted"));
      }
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // container may already be detached
        }
      }
      hasExecutedRef.current = false;
      widgetIdRef.current = null;
    };
  }, [container, resolvedSiteKey, action, size, theme, execution, appearance, timeoutMs, handleFailure, clearRetryGuard]);

  const reset = useCallback(() => {
    hasExecutedRef.current = false;
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (err) {
        console.error("Error resetting Turnstile widget:", err);
      }
    }
  }, []);

  /** Explicitly triggers an "execute"-mode widget and resolves with the token. */
  const execute = useCallback(async (): Promise<string> => {
    // Serialize calls so a single widget is never executed concurrently.
    while (inFlightRef.current) {
      try {
        await inFlightRef.current;
      } catch {
        // Prior attempt failed; proceed with a fresh attempt.
      }
    }

    const run = (async () => {
      // The script may still be loading or the widget still rendering right
      // after its container mounted: wait briefly instead of failing instantly.
      const readyDeadline = Date.now() + READY_WAIT_MS;
      while (!(window.turnstile && widgetIdRef.current) && Date.now() < readyDeadline) {
        await new Promise((r) => setTimeout(r, 100));
      }

      return new Promise<string>((resolve, reject) => {
        const widgetId = widgetIdRef.current;
        if (!window.turnstile || !widgetId) {
          reject(new Error("Turnstile non pronto. Ricarica la pagina."));
          return;
        }
        retriedRef.current = false;
        clearRetryGuard();
        let settled = false;

        const settleResolve = (token: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          clearRetryGuard();
          resolverRef.current = null;
          rejecterRef.current = null;
          resolve(token);
        };
        const settleReject = (err: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          clearRetryGuard();
          resolverRef.current = null;
          rejecterRef.current = null;
          reject(err);
        };

        resolverRef.current = settleResolve;
        rejecterRef.current = settleReject;

        const timeoutId = setTimeout(() => {
          handleFailure("Turnstile: nessuna risposta entro il timeout.");
        }, timeoutMs);

        try {
          // Turnstile execute()-mode widgets return the previous single-use token
          // unless reset() is called before minting a new token.
          if (hasExecutedRef.current) {
            window.turnstile.reset(widgetId);
          }
          hasExecutedRef.current = true;
          window.turnstile.execute(widgetId);
        } catch (err) {
          settleReject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    })();

    inFlightRef.current = run;
    try {
      return await run;
    } finally {
      if (inFlightRef.current === run) {
        inFlightRef.current = null;
      }
    }
  }, [timeoutMs, handleFailure, clearRetryGuard]);

  return { containerRef, reset, execute };
}
