import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/shops/route";
import {
  LOCAL_DEV_SHOP_FIXTURES,
  MAX_BOUNDS_SPAN_DEG,
  MIN_MAP_ZOOM,
  PLACES_BASIC_FIELD_MASK,
} from "@/lib/map-proxy-config";
import { resetRateLimitFallbackForTests } from "@/lib/rate-limit-fallback";

vi.mock("@/lib/cost-guard", () => ({
  paidApisDisabled: vi.fn(() => false),
}));

vi.mock("@/lib/turnstile", () => ({
  validateTurnstileToken: vi.fn(async () => true),
}));

vi.mock("@/lib/ip-utils", () => ({
  getClientIp: vi.fn(async () => "203.0.113.10"),
}));

import { paidApisDisabled } from "@/lib/cost-guard";
import { validateTurnstileToken } from "@/lib/turnstile";

describe("API /api/shops", () => {
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

  test("returns 400 when bounds and query are missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/shops", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  test(`returns 400 when viewport span exceeds ${MAX_BOUNDS_SPAN_DEG} degrees`, async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=46.5&southwestLat=44.0&northeastLng=10.5&southwestLng=8.0",
      { headers: { "x-turnstile-token": "valid-token" } }
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  test(`returns 400 when zoom is below minimum (${MIN_MAP_ZOOM})`, async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=45.5&southwestLat=45.4&northeastLng=9.2&southwestLng=9.1&zoom=12",
      { headers: { "x-turnstile-token": "valid-token" } }
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Zoom minimo");
  });

  test("returns 403 when Turnstile token is missing or invalid", async () => {
    const missingTokenReq = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=45.5&southwestLat=45.4&northeastLng=9.2&southwestLng=9.1"
    );
    const missingRes = await GET(missingTokenReq);
    expect(missingRes.status).toBe(403);

    vi.mocked(validateTurnstileToken).mockResolvedValueOnce(false);
    const invalidTokenReq = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=45.5&southwestLat=45.4&northeastLng=9.2&southwestLng=9.1",
      { headers: { "x-turnstile-token": "bad-token" } }
    );
    const invalidRes = await GET(invalidTokenReq);
    expect(invalidRes.status).toBe(403);
    expect(validateTurnstileToken).toHaveBeenCalledWith("bad-token", "203.0.113.10", "shops_search");
  });

  test("enforces per-IP rate limiting (429) after 30 requests", async () => {
    vi.mocked(paidApisDisabled).mockReturnValue(true);

    for (let i = 0; i < 30; i++) {
      const req = new NextRequest(
        "http://localhost:3000/api/shops?northeastLat=45.5&southwestLat=45.4&northeastLng=9.2&southwestLng=9.1",
        { headers: { "x-turnstile-token": "valid-token" } }
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
    }

    const limitedReq = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=45.5&southwestLat=45.4&northeastLng=9.2&southwestLng=9.1",
      { headers: { "x-turnstile-token": "valid-token" } }
    );
    const limitedRes = await GET(limitedReq);
    expect(limitedRes.status).toBe(429);
  });

  test("returns local_only when text query q is sent without map bounds", async () => {
    const req = new NextRequest("http://localhost:3000/api/shops?q=milano", {
      headers: { "x-turnstile-token": "valid-token" },
    });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ shops: [], source: "local_only" });
  });

  test("returns safe bounded fixtures without calling Google when paid APIs kill-switch is active", async () => {
    vi.mocked(paidApisDisabled).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Covers Milan fixtures
    const req = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=45.50&southwestLat=45.44&northeastLng=9.22&southwestLng=9.15&zoom=14",
      { headers: { "x-turnstile-token": "valid-token" } }
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.source).toBe("paid_apis_disabled");
    expect(data.shops.length).toBeGreaterThan(0);
    expect(data.shops.every((s: { city: string }) => s.city === "Milano")).toBe(true);
    expect(LOCAL_DEV_SHOP_FIXTURES.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("queries Google Places with minimal places.id,places.location field mask and filters invalid coordinates only", async () => {
    process.env.GOOGLE_PLACES_BACKEND_KEY = "test-google-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: "place_123",
            location: { latitude: 45.462, longitude: 9.187 },
          },
          {
            id: "place_456",
            location: { latitude: 45.463, longitude: 9.188 },
          },
          {
            id: "",
            location: { latitude: 45.464, longitude: 9.189 },
          },
          {
            id: "place_missing_location",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=45.5&southwestLat=45.4&northeastLng=9.2&southwestLng=9.1&zoom=14",
      { headers: { "x-turnstile-token": "valid-token" } }
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(data.source).toBe("google");
    expect(data.saturated).toBe(false);
    expect(data.shops).toHaveLength(2);
    expect(data.shops.map((s: { place_id: string }) => s.place_id)).toEqual([
      "place_123",
      "place_456",
    ]);
    expect(data.shops[0]).toEqual({
      place_id: "place_123",
      name: null,
      latitude: 45.462,
      longitude: 9.187,
      address: null,
      city: null,
      region: null,
      country: null,
      data_source: "google",
    });
    expect(data.shops[0]).not.toHaveProperty("global_rating");
    expect(data.shops[0]).not.toHaveProperty("total_reviews");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, fetchOpts] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(fetchOpts.body as string);
    expect(parsedBody.textQuery).toBe("kebab");
    expect(parsedBody.textQuery).not.toContain("OR");
    expect(parsedBody.languageCode).toBe("it");
    expect(parsedBody.pageSize).toBe(20);

    const fieldMask = fetchOpts.headers["X-Goog-FieldMask"] as string;
    expect(PLACES_BASIC_FIELD_MASK).toBe("places.id,places.location");
    expect(fieldMask).toBe("places.id,places.location");
    expect(fieldMask).not.toContain("types");
    expect(fieldMask).not.toContain("reviews");
    expect(fieldMask).not.toContain("photos");
    expect(fieldMask).not.toContain("rating");
    expect(fieldMask).not.toContain("displayName");
    expect(fieldMask).not.toContain("formattedAddress");
  });

  test("marks saturated=true when Google returns 20 raw places and formats text query without OR", async () => {
    process.env.GOOGLE_PLACES_BACKEND_KEY = "test-google-key";
    const places20 = Array.from({ length: 20 }, (_, i) => ({
      id: `place_${i}`,
      location: { latitude: 45.46 + i * 0.0001, longitude: 9.18 + i * 0.0001 },
      types: ["restaurant"],
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: places20 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest(
      "http://localhost:3000/api/shops?northeastLat=45.5&southwestLat=45.4&northeastLng=9.2&southwestLng=9.1&zoom=14&q=istanbul",
      { headers: { "x-turnstile-token": "valid-token" } }
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.saturated).toBe(true);
    expect(data.shops).toHaveLength(20);
    const [, fetchOpts] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(fetchOpts.body as string);
    expect(parsedBody.textQuery).toBe("istanbul kebab");
    expect(parsedBody.textQuery).not.toContain("OR");
  });
});
