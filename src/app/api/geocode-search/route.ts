import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip-utils";
import { checkRateLimitFallback } from "@/lib/rate-limit-fallback";
import { validateTurnstileToken } from "@/lib/turnstile";
import { paidApisDisabled } from "@/lib/cost-guard";
import { serverError } from "@/lib/server-errors";
import {
  LOCAL_DEV_GEOCODE_FIXTURES,
  type GeocodeProxyResult,
} from "@/lib/map-proxy-config";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

interface RawGeocodeItem {
  place_id?: unknown;
  geometry?: { location?: { lat?: unknown; lng?: unknown } };
}

function isValidGeocodeItem(item: RawGeocodeItem): item is {
  place_id: string;
  geometry: { location: { lat: number; lng: number } };
} {
  const lat = item?.geometry?.location?.lat;
  const lng = item?.geometry?.location?.lng;
  return (
    typeof item?.place_id === "string" &&
    item.place_id.trim().length > 0 &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

function filterGeocodeFixtures(query: string): GeocodeProxyResult[] {
  const normalized = query.toLowerCase();
  return LOCAL_DEV_GEOCODE_FIXTURES.filter(
    (item) =>
      (item.city?.toLowerCase().includes(normalized) ?? false) ||
      (item.display_name?.toLowerCase().includes(normalized) ?? false)
  );
}

/**
 * Geocode Search Proxy — Server-Side Zero-DB (Google Geocoding API)
 *
 * Uses Google Geocoding API (Essentials tier) for on-submit place/address search.
 * Protected by Cloudflare Turnstile + per-isolate Rate Limiting.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = await getClientIp();

    const allowed = checkRateLimitFallback("ratelimit_geocode_search", ip, 10, 10 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Troppe richieste di ricerca. Riprova tra qualche secondo." },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const turnstileToken =
      req.headers.get("x-turnstile-token") || searchParams.get("turnstileToken");
    if (!turnstileToken || !(await validateTurnstileToken(turnstileToken, ip, "geocode_search"))) {
      return NextResponse.json(
        { error: "Verifica anti-bot fallita." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const q = searchParams.get("q");
    if (!q || q.trim().length < 2) {
      return NextResponse.json({ results: [] }, { headers: NO_STORE_HEADERS });
    }

    const sanitizedQuery = q.trim().slice(0, 200);
    const googleKey = process.env.GOOGLE_PLACES_BACKEND_KEY || "";
    if (
      paidApisDisabled() ||
      !googleKey ||
      googleKey === "your-google-places-backend-key-here"
    ) {
      return NextResponse.json(
        {
          results: filterGeocodeFixtures(sanitizedQuery),
          source: "paid_apis_disabled",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(sanitizedQuery)}&key=${googleKey}&language=it`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response | null = null;
    try {
      response = await fetch(geocodeUrl, { signal: controller.signal });
    } catch {
      // Network or timeout error on Google API
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { results: [], source: "google_unavailable" },
        { headers: NO_STORE_HEADERS }
      );
    }

    const data = await response.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Geocode Search] Google API Error:", data.status);
      return NextResponse.json(
        { results: [], source: "google_error" },
        { headers: NO_STORE_HEADERS }
      );
    }

    // EEA Terms compliance: Geocoding API content other than latitude, longitude,
    // and place_id must not be used With any Map. Return top coordinate match only.
    const rawResults = Array.isArray(data.results) ? (data.results as RawGeocodeItem[]) : [];
    const results: GeocodeProxyResult[] = rawResults
      .filter(isValidGeocodeItem)
      .slice(0, 1)
      .map((item) => ({
        place_id: item.place_id,
        display_name: null,
        lat: String(item.geometry.location.lat),
        lon: String(item.geometry.location.lng),
        city: null,
        country: null,
        data_source: "google" as const,
      }));

    return NextResponse.json(
      { results, source: "google" },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const res = serverError("Geocode Search", error);
    res.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
    return res;
  }
}
