import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/support-contact/route";
import { resetRateLimitFallbackForTests } from "@/lib/rate-limit-fallback";

vi.mock("@/lib/turnstile", () => ({
  validateTurnstileToken: vi.fn(async () => true),
}));

vi.mock("@/lib/ip-utils", () => ({
  getClientIp: vi.fn(async () => "203.0.113.55"),
}));

import { validateTurnstileToken } from "@/lib/turnstile";

describe("API /api/support-contact", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitFallbackForTests();
    process.env = {
      ...originalEnv,
      TURNSTILE_SUPPORT_SECRET_KEY: "support-secret",
      SUPPORT_EMAIL: "support@kebapps.app",
    };
    vi.mocked(validateTurnstileToken).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  test("returns 403 when Turnstile token is missing or invalid", async () => {
    const missingReq = new NextRequest("http://localhost:3000/api/support-contact");
    const missingRes = await GET(missingReq);
    expect(missingRes.status).toBe(403);
    expect(missingRes.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(validateTurnstileToken).not.toHaveBeenCalled();

    vi.mocked(validateTurnstileToken).mockResolvedValueOnce(false);
    const invalidReq = new NextRequest("http://localhost:3000/api/support-contact", {
      headers: { "x-turnstile-token": "bad-token" },
    });
    const invalidRes = await GET(invalidReq);
    expect(invalidRes.status).toBe(403);
    expect(validateTurnstileToken).toHaveBeenCalledWith(
      "bad-token",
      "203.0.113.55",
      "support_contact",
      {
        secretKey: "support-secret",
        secretEnvName: "TURNSTILE_SUPPORT_SECRET_KEY",
      }
    );
  });

  test("enforces rate limiting (429) after 5 requests in 60s", async () => {
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest("http://localhost:3000/api/support-contact", {
        headers: { "x-turnstile-token": "valid-token" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    }

    const limitedReq = new NextRequest("http://localhost:3000/api/support-contact", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const limitedRes = await GET(limitedReq);
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  test("returns configured SUPPORT_EMAIL with no-store headers on valid verification", async () => {
    process.env.SUPPORT_EMAIL = "custom-help@kebapps.app";
    const req = new NextRequest("http://localhost:3000/api/support-contact", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(data).toEqual({
      email: "custom-help@kebapps.app",
      subject: "[KebApps] Supporto / Segnalazione",
      source: "live",
    });
  });

  test("fails closed (503) in production when SUPPORT_EMAIL is missing or invalid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.SUPPORT_EMAIL;

    const missingReq = new NextRequest("http://localhost:3000/api/support-contact", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const missingRes = await GET(missingReq);
    expect(missingRes.status).toBe(503);
    expect(missingRes.headers.get("Cache-Control")).toBe("no-store, max-age=0");

    process.env.SUPPORT_EMAIL = "not-an-email";
    const invalidReq = new NextRequest("http://localhost:3000/api/support-contact", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const invalidRes = await GET(invalidReq);
    expect(invalidRes.status).toBe(503);
    vi.unstubAllEnvs();
  });

  test("returns safe dev fallback outside production when SUPPORT_EMAIL is unset", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.SUPPORT_EMAIL;
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

    const req = new NextRequest("http://localhost:3000/api/support-contact", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      email: "support@kebapps.app",
      subject: "[KebApps] Supporto / Segnalazione",
      source: "dev_fallback",
    });
    vi.unstubAllEnvs();
  });
});
