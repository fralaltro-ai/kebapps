export const CHUNK_RECOVERY_STORAGE_KEY = "kebapps_chunk_reload_ts";
export const CHUNK_RECOVERY_COOLDOWN_MS = 15_000;

/**
 * Detects webpack chunk-load failures and deploy-skew TypeErrors
 * (for example `c[e] is not a function` when a cached HTML/RSC payload
 * references modules missing from newly deployed chunks).
 */
export function isChunkOrSkewError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: unknown; message?: unknown; stack?: unknown };
  const name = typeof err.name === "string" ? err.name : "";
  const message = typeof err.message === "string" ? err.message : "";
  const stack = typeof err.stack === "string" ? err.stack : "";

  if (name === "ChunkLoadError") return true;

  if (
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /\b[a-z_$]\[[a-z_$]\]\s+is not a function/i.test(message) ||
    /\b[a-z_$]\[[a-z_$]\]\s+is undefined/i.test(message) ||
    /undefined is not a function.*webpack/i.test(message)
  ) {
    return true;
  }

  if (
    /\/_next\/static\/chunks\/webpack-[a-f0-9]+\.js/i.test(stack) &&
    /is not a function|Cannot read properties of undefined/i.test(message)
  ) {
    return true;
  }

  return false;
}

/**
 * Allows at most one automatic hard reload per cooldown window using
 * ephemeral `sessionStorage` so recovery never enters a reload loop.
 */
export function attemptOneShotChunkRecovery(
  nowMs: number = Date.now(),
  storage?: Pick<Storage, "getItem" | "setItem"> | null
): boolean {
  try {
    const target =
      storage !== undefined
        ? storage
        : typeof window !== "undefined"
          ? window.sessionStorage
          : null;
    if (!target) return false;

    const raw = target.getItem(CHUNK_RECOVERY_STORAGE_KEY);
    if (raw !== null) {
      const lastTs = Number(raw);
      if (Number.isFinite(lastTs) && nowMs - lastTs < CHUNK_RECOVERY_COOLDOWN_MS) {
        return false;
      }
    }

    target.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(nowMs));
    return true;
  } catch {
    return false;
  }
}

/** Triggers a full browser reload to fetch fresh HTML, RSC, and chunk manifests. */
export function triggerHardReload(): void {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}
