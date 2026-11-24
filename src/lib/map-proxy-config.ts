export interface ProxyShopResult {
  place_id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  data_source: "google" | "fixture";
}

export interface GeocodeProxyResult {
  place_id: string;
  display_name: string | null;
  lat: string;
  lon: string;
  city: string | null;
  country: string | null;
  data_source?: "google" | "fixture";
}

export const MAX_BOUNDS_SPAN_DEG = 1.2;
export const MIN_MAP_ZOOM = 13;

// Strictly IDs and location ONLY: under Google Maps Platform EEA Terms,
// Places API content other than latitude, longitude, and place_id (including
// places.types) must NEVER be used With any Map.
// Place details UI is rendered client-side via the EEA-exempt Places UI Kit.
export const PLACES_BASIC_FIELD_MASK =
  "places.id,places.location";

export function getSanitizedGoogleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

export function getSanitizedGoogleMapsMapId(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

export function hasConfiguredGoogleMapsKey(): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_PAID_APIS === "1") {
    return false;
  }
  const key = getSanitizedGoogleMapsApiKey();
  return Boolean(
    key &&
      key !== "AIzaSyYourPublicFrontendKey" &&
      key !== "your-google-maps-api-key-here"
  );
}

/**
 * Resolves the Google Maps Map ID.
 * DEMO_MAP_ID is strictly forbidden in production by Google Maps Platform Demo Terms.
 */
export function resolveGoogleMapsMapId(): string | null {
  const configured = getSanitizedGoogleMapsMapId();
  if (process.env.NODE_ENV === "production") {
    if (!configured || configured === "DEMO_MAP_ID") {
      return null;
    }
    return configured;
  }
  return configured || "DEMO_MAP_ID";
}

export const LOCAL_DEV_SHOP_FIXTURES: ProxyShopResult[] = [
  {
    place_id: "fixture_milano_duomo_kebap",
    name: "Kebab Demo Duomo (Esempio)",
    latitude: 45.4628,
    longitude: 9.1872,
    address: "Piazza del Duomo (Dato Dimostrativo), 20121 Milano MI, Italia",
    city: "Milano",
    region: "Lombardy",
    country: "Italy",
    data_source: "fixture",
  },
  {
    place_id: "fixture_milano_porta_venezia",
    name: "Spiedo Demo Porta Venezia (Esempio)",
    latitude: 45.4754,
    longitude: 9.2055,
    address: "Piazzale Oberdan (Dato Dimostrativo), 20129 Milano MI, Italia",
    city: "Milano",
    region: "Lombardy",
    country: "Italy",
    data_source: "fixture",
  },
  {
    place_id: "fixture_roma_termini",
    name: "Shawarma Demo Termini (Esempio)",
    latitude: 41.9012,
    longitude: 12.5008,
    address: "Piazza dei Cinquecento (Dato Dimostrativo), 00185 Roma RM, Italia",
    city: "Roma",
    region: "Latium",
    country: "Italy",
    data_source: "fixture",
  },
  {
    place_id: "fixture_roma_trastevere",
    name: "Pita Demo Trastevere (Esempio)",
    latitude: 41.8897,
    longitude: 12.4712,
    address: "Piazza di Santa Maria in Trastevere (Dato Dimostrativo), 00153 Roma RM, Italia",
    city: "Roma",
    region: "Latium",
    country: "Italy",
    data_source: "fixture",
  },
  {
    place_id: "fixture_torino_centro",
    name: "Doner Demo Castello (Esempio)",
    latitude: 45.0703,
    longitude: 7.6869,
    address: "Piazza Castello (Dato Dimostrativo), 10122 Torino TO, Italia",
    city: "Torino",
    region: "Piedmont",
    country: "Italy",
    data_source: "fixture",
  },
  {
    place_id: "fixture_bologna_universita",
    name: "Kebab Demo Maggiore (Esempio)",
    latitude: 44.4968,
    longitude: 11.3514,
    address: "Piazza Maggiore (Dato Dimostrativo), 40124 Bologna BO, Italia",
    city: "Bologna",
    region: "Emilia-Romagna",
    country: "Italy",
    data_source: "fixture",
  },
  {
    place_id: "fixture_napoli_spaccanapoli",
    name: "Falafel Demo Plebiscito (Esempio)",
    latitude: 40.8492,
    longitude: 14.2546,
    address: "Piazza del Plebiscito (Dato Dimostrativo), 80132 Napoli NA, Italia",
    city: "Napoli",
    region: "Campania",
    country: "Italy",
    data_source: "fixture",
  },
];

export const LOCAL_DEV_GEOCODE_FIXTURES: GeocodeProxyResult[] = [
  {
    place_id: "fixture_city_milano",
    display_name: "Milano MI, Italia",
    lat: "45.4642",
    lon: "9.1900",
    city: "Milano",
    country: "Italia",
    data_source: "fixture",
  },
  {
    place_id: "fixture_city_roma",
    display_name: "Roma RM, Italia",
    lat: "41.9028",
    lon: "12.4964",
    city: "Roma",
    country: "Italia",
    data_source: "fixture",
  },
  {
    place_id: "fixture_city_torino",
    display_name: "Torino TO, Italia",
    lat: "45.0703",
    lon: "7.6869",
    city: "Torino",
    country: "Italia",
    data_source: "fixture",
  },
  {
    place_id: "fixture_city_bologna",
    display_name: "Bologna BO, Italia",
    lat: "44.4949",
    lon: "11.3426",
    city: "Bologna",
    country: "Italia",
    data_source: "fixture",
  },
  {
    place_id: "fixture_city_napoli",
    display_name: "Napoli NA, Italia",
    lat: "40.8518",
    lon: "14.2681",
    city: "Napoli",
    country: "Italia",
    data_source: "fixture",
  },
  {
    place_id: "fixture_city_firenze",
    display_name: "Firenze FI, Italia",
    lat: "43.7696",
    lon: "11.2558",
    city: "Firenze",
    country: "Italia",
    data_source: "fixture",
  },
];
