import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
z.config({ jitless: true });
import { checkRateLimitFallback } from "@/lib/rate-limit-fallback";
import { getClientIp } from "@/lib/ip-utils";
import { paidApisDisabled } from "@/lib/cost-guard";
import { validateTurnstileToken } from "@/lib/turnstile";
import {
  LOCAL_DEV_SHOP_FIXTURES,
  MAX_BOUNDS_SPAN_DEG,
  MIN_MAP_ZOOM,
  PLACES_BASIC_FIELD_MASK,
  type ProxyShopResult,
} from "@/lib/map-proxy-config";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

const parseNumberOrNull = (val: unknown) => (val === null || val === "" ? undefined : val);

const boundsSchema = z
  .object({
    neLat: z.preprocess(parseNumberOrNull, z.coerce.number().min(-90).max(90).optional()),
    neLng: z.preprocess(parseNumberOrNull, z.coerce.number().min(-180).max(180).optional()),
    swLat: z.preprocess(parseNumberOrNull, z.coerce.number().min(-90).max(90).optional()),
    swLng: z.preprocess(parseNumberOrNull, z.coerce.number().min(-180).max(180).optional()),
    zoom: z.preprocess(parseNumberOrNull, z.coerce.number().finite().max(22).optional()),
    q: z.string().trim().min(2).max(64).optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.neLat !== undefined &&
        data.swLat !== undefined &&
        data.neLng !== undefined &&
        data.swLng !== undefined
      ) {
        if (data.neLat <= data.swLat || data.neLng <= data.swLng) {
          return false;
        }
        const latSpan = Math.abs(data.neLat - data.swLat);
        const lngSpan = Math.abs(data.neLng - data.swLng);
        // Enforce max 1.20 deg span (~120km viewport at minZoom 13 + expandBounds buffer)
        return latSpan <= MAX_BOUNDS_SPAN_DEG && lngSpan <= MAX_BOUNDS_SPAN_DEG;
      }
      return true;
    },
    {
      message: "Area di ricerca troppo ampia o coordinate non valide.",
      path: ["bounds"],
    }
  );

type GooglePlace = {
  id?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
};

const hasValidPlaceLocation = (
  place: GooglePlace
): place is { id: string; location: { latitude: number; longitude: number } } => {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  return (
    typeof place.id === "string" &&
    place.id.trim().length > 0 &&
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
};

function filterFixtureShops(
  bounds: { neLat: number; neLng: number; swLat: number; swLng: number },
  q?: string | null
): ProxyShopResult[] {
  const normalizedQ = q?.trim().toLowerCase() || "";
  return LOCAL_DEV_SHOP_FIXTURES.filter((shop) => {
    const insideBounds =
      shop.latitude >= bounds.swLat &&
      shop.latitude <= bounds.neLat &&
      shop.longitude >= bounds.swLng &&
      shop.longitude <= bounds.neLng;
    if (!insideBounds) return false;
    if (!normalizedQ) return true;
    return (
      (shop.name?.toLowerCase().includes(normalizedQ) ?? false) ||
      (shop.address?.toLowerCase().includes(normalizedQ) ?? false) ||
      (shop.city?.toLowerCase().includes(normalizedQ) ?? false)
    );
  });
}

export async function GET(request: NextRequest) {
  try {
    const ip = await getClientIp();
    const allowed = checkRateLimitFallback("ratelimit_shops", ip, 30, 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too Many Requests" },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const validationResult = boundsSchema.safeParse({
      neLat: searchParams.get("northeastLat"),
      neLng: searchParams.get("northeastLng"),
      swLat: searchParams.get("southwestLat"),
      swLng: searchParams.get("southwestLng"),
      zoom: searchParams.get("zoom"),
      q: searchParams.get("q"),
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Parametri di ricerca non validi." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const { neLat, neLng, swLat, swLng, zoom, q } = validationResult.data;

    if (zoom !== undefined && zoom < MIN_MAP_ZOOM) {
      return NextResponse.json(
        { error: "Zoom minimo richiesto non soddisfatto." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const turnstileToken =
      request.headers.get("x-turnstile-token") || searchParams.get("turnstileToken");
    if (!turnstileToken || !(await validateTurnstileToken(turnstileToken, ip, "shops_search"))) {
      return NextResponse.json(
        { error: "Verifica anti-bot fallita." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (q && (neLat === undefined || neLng === undefined || swLat === undefined || swLng === undefined)) {
      return NextResponse.json(
        { shops: [], source: "local_only" },
        { headers: NO_STORE_HEADERS }
      );
    }

    if (neLat === undefined || neLng === undefined || swLat === undefined || swLng === undefined) {
      return NextResponse.json(
        { error: "Parametri di ricerca non validi." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const googleBackendKey = process.env.GOOGLE_PLACES_BACKEND_KEY || "";
    if (
      paidApisDisabled() ||
      !googleBackendKey ||
      googleBackendKey === "your-google-places-backend-key-here"
    ) {
      const matchedFixtures = filterFixtureShops({ neLat, neLng, swLat, swLng }, q);
      return NextResponse.json(
        { shops: matchedFixtures, source: "paid_apis_disabled" },
        { headers: NO_STORE_HEADERS }
      );
    }

    const url = "https://places.googleapis.com/v1/places:searchText";
    const payload = {
      textQuery: q ? `${q} kebab` : "kebab",
      languageCode: "it",
      pageSize: 20,
      locationRestriction: {
        rectangle: {
          low: { latitude: swLat, longitude: swLng },
          high: { latitude: neLat, longitude: neLng },
        },
      },
    };

    const googleRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleBackendKey,
        "Accept-Language": "it",
        "X-Goog-FieldMask": PLACES_BASIC_FIELD_MASK,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!googleRes.ok) {
      console.error("[Shops API] Google Places API returned status:", googleRes.status);
      return NextResponse.json(
        { shops: [], source: "google_error" },
        { headers: NO_STORE_HEADERS }
      );
    }

    const googleData = (await googleRes.json()) as { places?: GooglePlace[] };
    const rawPlaces = googleData.places || [];
    const saturated = rawPlaces.length >= 20;
    const places = rawPlaces.filter(hasValidPlaceLocation);

    // EEA Terms compliance: only return latitude, longitude, and place_id for Google Places results.
    const shops: ProxyShopResult[] = places.map((place) => ({
      place_id: place.id,
      name: null,
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      address: null,
      city: null,
      region: null,
      country: null,
      data_source: "google",
    }));

    return NextResponse.json(
      { shops, source: "google", saturated },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    console.error(
      "[API/shops] Unhandled GET Error:",
      err instanceof Error ? err.message : "unknown_error"
    );
    return NextResponse.json(
      { error: "Errore interno del server." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
