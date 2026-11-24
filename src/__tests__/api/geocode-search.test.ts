import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/geocode-search/route";
import { resetRateLimitFallbackForTests } from "@/lib/rate-limit-fallback";

vi.mock("@/lib/cost-guard", () => ({
  paidApisDisabled: vi.fn(() => false),
}));

vi.mock("@/lib/turnstile", () => ({
  validateTurnstileToken: vi.fn(async () => true),
}));

vi.mock("@/lib/ip-utils", () => ({
  getClientIp: vi.fn(async () => "203.0.113.20"),
}));

import { paidApisDisabled } from "@/lib/cost-guard";
import { validateTurnstileToken } from "@/lib/turnstile";

describe("API /api/geocode-search", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitFallbackForTests();
    process.env = { ...originalEnv };
    vi.mocked(paidApisDisabled).mockReturnValue(false);
    vi.mocked(validateTurnstileToken).mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  test("returns 403 when Turnstile token is missing or fails validation", async () => {
    const missingReq = new NextRequest("http://localhost:3000/api/geocode-search?q=Milano");
    const missingRes = await GET(missingReq);
    expect(missingRes.status).toBe(403);

    vi.mocked(validateTurnstileToken).mockResolvedValueOnce(false);
    const invalidReq = new NextRequest("http://localhost:3000/api/geocode-search?q=Milano", {
      headers: { "x-turnstile-token": "bad-token" },
    });
    const invalidRes = await GET(invalidReq);
    expect(invalidRes.status).toBe(403);
    expect(validateTurnstileToken).toHaveBeenCalledWith(
      "bad-token",
      "203.0.113.20",
      "geocode_search"
    );
  });

  test("enforces rate limiting (429) after 10 requests in 10s", async () => {
    vi.mocked(paidApisDisabled).mockReturnValue(true);

    for (let i = 0; i < 10; i++) {
      const req = new NextRequest("http://localhost:3000/api/geocode-search?q=Milano", {
        headers: { "x-turnstile-token": "valid-token" },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
    }

    const limitedReq = new NextRequest("http://localhost:3000/api/geocode-search?q=Milano", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const limitedRes = await GET(limitedReq);
    expect(limitedRes.status).toBe(429);
  });

  test("returns empty results for query shorter than 2 characters", async () => {
    const req = new NextRequest("http://localhost:3000/api/geocode-search?q=a", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ results: [] });
  });

  test("returns safe local fixtures without network calls when paidApisDisabled is active", async () => {
    vi.mocked(paidApisDisabled).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/geocode-search?q=Milano", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.source).toBe("paid_apis_disabled");
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toMatchObject({
      place_id: "fixture_city_milano",
      city: "Milano",
      lat: "45.4642",
      lon: "9.1900",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("proxies Google Geocoding API when enabled and maps results safely", async () => {
    process.env.GOOGLE_PLACES_BACKEND_KEY = "test-google-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          {
            place_id: "ChIJ_milano",
            formatted_address: "Milano MI, Italia",
            geometry: { location: { lat: 45.4642, lng: 9.19 } },
            address_components: [
              { long_name: "Milano", types: ["locality"] },
              { long_name: "Italia", types: ["country"] },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/geocode-search?q=Milano", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(data.source).toBe("google");
    expect(data.results).toEqual([
      {
        place_id: "ChIJ_milano",
        display_name: null,
        lat: "45.4642",
        lon: "9.19",
        city: null,
        country: null,
        data_source: "google",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("filters out Google geocode results missing valid finite coordinates instead of falling back to 0,0", async () => {
    process.env.GOOGLE_PLACES_BACKEND_KEY = "test-google-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          {
            place_id: "ChIJ_broken_geom",
            geometry: {},
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost:3000/api/geocode-search?q=Nowhere", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(data.results).toEqual([]);
  });
});
