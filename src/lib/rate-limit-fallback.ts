const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();
const MAX_ENTRIES_PER_PREFIX = 10000;

/**
 * Per-isolate in-memory rate limiter.
 * Sweeps expired entries probabilistically and enforces a max size cap per prefix.
 *
 * @param prefix Unique prefix for the rate limit (e.g. "shops")
 * @param key Client identifier (IP)
 * @param limit Max requests allowed
 * @param windowMs Time window in milliseconds
 * @returns boolean indicating if the request is allowed (true = allowed, false = ratelimited)
 */
export function checkRateLimitFallback(
  prefix: string,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  if (!stores.has(prefix)) {
    stores.set(prefix, new Map());
  }
  const store = stores.get(prefix)!;

  const now = Date.now();

  if (Math.random() < 0.01) {
    for (const [, prefixStore] of stores.entries()) {
      for (const [k, val] of prefixStore.entries()) {
        if (val.resetAt < now) prefixStore.delete(k);
      }
    }
  }

  if (store.size >= MAX_ENTRIES_PER_PREFIX) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) {
      store.delete(oldestKey);
    }
  }

  const record = store.get(key);

  if (!record || record.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

/**
 * Clears all in-memory rate-limit buckets. Intended for unit tests.
 */
export function resetRateLimitFallbackForTests(): void {
  stores.clear();
}
