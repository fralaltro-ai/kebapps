import { describe, expect, it } from "vitest";
import {
  attemptOneShotChunkRecovery,
  CHUNK_RECOVERY_COOLDOWN_MS,
  CHUNK_RECOVERY_STORAGE_KEY,
  isChunkOrSkewError,
} from "../chunk-error-recovery";

describe("chunk-error-recovery", () => {
  describe("isChunkOrSkewError", () => {
    it("detects webpack module lookup TypeErrors such as c[e] is not a function", () => {
      expect(isChunkOrSkewError(new TypeError("c[e] is not a function"))).toBe(true);
      expect(
        isChunkOrSkewError(
          new TypeError("c[e] is not a function. (In 'c[e](r,r.exports,s)', 'c[e]' is undefined)")
        )
      ).toBe(true);
    });

    it("detects ChunkLoadError and dynamic module import failures", () => {
      const chunkErr = new Error("Loading chunk 946 failed.");
      chunkErr.name = "ChunkLoadError";
      expect(isChunkOrSkewError(chunkErr)).toBe(true);

      expect(
        isChunkOrSkewError(new Error("Failed to fetch dynamically imported module /_next/static/chunks/foo.js"))
      ).toBe(true);
      expect(isChunkOrSkewError(new Error("Importing a module script failed."))).toBe(true);
    });

    it("detects undefined call errors originating from webpack runtime chunk stack", () => {
      const err = new TypeError("Cannot read properties of undefined (reading 'call')");
      err.stack = "TypeError: Cannot read properties of undefined\n    at s (https://kebapps.app/_next/static/chunks/webpack-c2140cc61f48a201.js:1:234)";
      expect(isChunkOrSkewError(err)).toBe(true);
    });

    it("returns false for unrelated application errors", () => {
      expect(isChunkOrSkewError(new Error("Spiedo bloccato"))).toBe(false);
      expect(isChunkOrSkewError(new Error("Crash catastrofico"))).toBe(false);
      expect(isChunkOrSkewError(null)).toBe(false);
      expect(isChunkOrSkewError("string error")).toBe(false);
    });
  });

  describe("attemptOneShotChunkRecovery", () => {
    it("allows first reload, blocks repeat inside cooldown, and allows again after cooldown", () => {
      const map = new Map<string, string>();
      const storage = {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
          map.set(key, value);
        },
      };

      const t0 = 1_700_000_000_000;
      expect(attemptOneShotChunkRecovery(t0, storage)).toBe(true);
      expect(map.get(CHUNK_RECOVERY_STORAGE_KEY)).toBe(String(t0));

      expect(attemptOneShotChunkRecovery(t0 + 1_000, storage)).toBe(false);
      expect(attemptOneShotChunkRecovery(t0 + CHUNK_RECOVERY_COOLDOWN_MS - 1, storage)).toBe(false);
      expect(attemptOneShotChunkRecovery(t0 + CHUNK_RECOVERY_COOLDOWN_MS, storage)).toBe(true);
    });

    it("returns false cleanly when storage is unavailable or throws", () => {
      expect(attemptOneShotChunkRecovery(Date.now(), null)).toBe(false);
      const throwingStorage = {
        getItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
        setItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
      };
      expect(attemptOneShotChunkRecovery(Date.now(), throwingStorage)).toBe(false);
    });
  });
});
