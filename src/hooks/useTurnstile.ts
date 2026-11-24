"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseTurnstileOptions {
  /**
   * Action name bound into the token at mint time (Turnstile `action` param).
   * Must match the `expectedAction` passed server-side to validateTurnstileToken
   * for the check to mean anything (SEC-BOT-12) — required so no call site forgets it.
   */
  action: string;
  size?: "normal" | "compact" | "invisible";
  theme?: "auto" | "light" | "dark";
  /** "render" (default): widget auto-executes on mount/reset. "execute": waits for execute(). */
  execution?: "render" | "execute";
  /** Called with the token on every successful verification (mainly for "render" mode). */
  onVerify?: (token: string) => void;
  /** Called once the original attempt AND the transparent retry have both failed. */
  onError?: (message: string) => void;
  /** Ms to wait for a response before treating an execute() call as failed (default 15s). */
  timeoutMs?: number;
}

/** Max ms execute() waits for the script/container to become ready before rejecting. */
const READY_WAIT_MS = 5000;

const TURNSTILE_SCRIPT_ATTR = "data-kebapp-turnstile";
let turnstileScriptPromise: Promise<void> | null = null;

/**
 * COMP-AUDIT-D2: loads the Turnstile script on demand, the first time any widget on the
 * page actually mounts, instead of unconditionally in the root layout on every route.
 * Idempotent and safe across concurrently-mounting widgets (module-level singleton
 * promise, and a marker attribute so a second hook instance finds the same <script> tag
 * rather than injecting a duplicate).
 */
function ensureTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${TURNSTILE_SCRIPT_ATTR}]`);
    if (existing) {
      if (window.turnstile) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => resolve(), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.setAttribute(TURNSTILE_SCRIPT_ATTR, "1");
    // Resolve on error too: renderWidget()'s own polling loop is the real readiness
    // gate (it checks window.turnstile), this promise only paces the first attempt.
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

/**
 * Shared Cloudflare Turnstile lifecycle hook (invisible mode, zero interactive popups).
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
  size = "invisible",
  theme = "auto",
  execution = "render",
  onVerify,
  onError,
  timeoutMs = 15000,
}: UseTurnstileOptions) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => setContainer(node), []);

  const widgetIdRef = useRef<string | null>(null);
  const resolverRef = useRef<((token: string) => void) | null>(null);
  const rejecterRef = useRef<((err: Error) => void) | null>(null);
  const retriedRef = useRef(false);
  const hasExecutedRef = useRef(false);
  const inFlightRef = useRef<Promise<string> | null>(null);
  const retryGuardRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest callbacks without forcing the render effect to re-run.
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  onVerifyRef.current = onVerify;
  onErrorRef.current = onError;

  const clearRetryGuard = useCallback(() => {
    if (retryGuardRef.current) {
      clearTimeout(retryGuardRef.current);
      retryGuardRef.current = null;
    }
  }, []);

  const handleFailure = useCallback((reason: string) => {
    clearRetryGuard();
    // Idle expiration/error with no active execute() caller: reset widget quietly without minting in background.
    if (!rejecterRef.current) {
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

    if (!retriedRef.current && widgetIdRef.current && window.turnstile) {
      retriedRef.current = true;
      try {
        window.turnstile.reset(widgetIdRef.current);
        if (execution === "execute") {
          window.turnstile.execute(widgetIdRef.current);
        }
        // Guard the retry itself: if it never calls back, fail hard instead of
        // leaving a pending promise hanging. Cleared on success, on settle and
        // on the next execute(), so it can never fire into a later attempt.
        retryGuardRef.current = setTimeout(() => {
          retryGuardRef.current = null;
          if (rejecterRef.current) {
            handleFailure("Turnstile: la verifica anti-bot non ha risposto dopo il retry.");
          }
        }, timeoutMs);
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
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
          action,
          size,
          theme,
          execution,
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
          "expired-callback": () => handleFailure("Verifica anti-bot scaduta."),
          "timeout-callback": () => handleFailure("Verifica anti-bot: timeout della challenge."),
        });
      } catch (err) {
        console.error("Error rendering Turnstile:", err);
      }
      // Script is present: stop polling whether or not render succeeded, a
      // render exception will not resolve itself by retrying every 500ms.
      return true;
    };

    void ensureTurnstileScript().then(() => {
      if (cancelled) return;
      if (!renderWidget()) {
        // Script loaded but window.turnstile not yet initialized: poll briefly.
        interval = setInterval(() => {
          if (renderWidget() && interval) clearInterval(interval);
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
  }, [container, action, size, theme, execution, handleFailure, clearRetryGuard]);

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
