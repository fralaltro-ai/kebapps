/**
 * GeoUtils - Offline Geodesic Engine for KebApp
 * Provides distance calculations and travel time estimations without external API calls.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculates the Haversine distance between two points in kilometers.
 */
export function calculateHaversineDistance(p1: LatLng, p2: LatLng): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * (Math.PI / 180)) *
      Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(Math.max(0, 1 - clampedA)));
  return R * c;
}

/**
 * Estimates travel time in minutes based on distance and mode.
 * Tortuosity factors: 1.3 for walking, 1.4 for driving.
 * Average speeds: 5 km/h walking, 30 km/h driving.
 */
export function estimateTravelTime(distanceKm: number, mode: 'walking' | 'driving'): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }
  if (mode === 'walking') {
    const estimatedDistance = distanceKm * 1.3;
    const hours = estimatedDistance / 5;
    return Math.max(1, Math.round(hours * 60));
  } else {
    const estimatedDistance = distanceKm * 1.4;
    const hours = estimatedDistance / 30;
    return Math.max(1, Math.round(hours * 60));
  }
}

/**
 * Generates a free Google Maps Deep Link for navigation.
 */
export function getGoogleMapsDeepLink(lat: number, lng: number): string {
  // Use destination only to trigger device GPS for origin
  const safeLat = Number.isFinite(lat) ? lat : 0;
  const safeLng = Number.isFinite(lng) ? lng : 0;
  return `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLng}`;
}

/**
 * Generates a free Google Maps external link preferring coordinates when available,
 * or falling back to place_id (for Google Places after 30-day coordinate expiry / backup restore)
 * or a plain text query.
 */
export function getGoogleMapsPlaceLink(
  query: string,
  placeId?: string | null,
  lat?: number | null,
  lng?: number | null
): string {
  if (lat !== null && lat !== undefined && lng !== null && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
    return getGoogleMapsDeepLink(lat, lng);
  }
  const cleanQuery = (query || "").trim() || "Kebab";
  const cleanPlaceId = (placeId || "").trim();
  if (
    cleanPlaceId &&
    !cleanPlaceId.startsWith("local_shop_") &&
    !cleanPlaceId.startsWith("wish_local_") &&
    !cleanPlaceId.startsWith("fixture_")
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanQuery)}&query_place_id=${encodeURIComponent(cleanPlaceId)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanQuery)}`;
}

/**
 * Formats minutes into a human-readable string (e.g., "15 min" or "1h 10m").
 */
export function formatTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return "--";
  }
  const rounded = Math.round(minutes);
  if (rounded < 60) {
    return `${rounded} min`;
  }
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Formats a kilometer distance cleanly (meters under 1 km, km otherwise).
 */
export function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return "--";
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Formats a shop's name safely for UI when absent.
 */
export function formatShopName(shop?: { name?: string | null }): string {
  if (shop?.name && shop.name.trim()) return shop.name;
  return "Locale in aggiornamento";
}

/**
 * Formats a shop's address safely for UI cards, providing an elegant fallback
 * when full street address is absent or purged by Google ToS TTL compliance.
 */
export function formatShopStreetAddress(shop?: { address?: string | null; city?: string | null }): string {
  if (shop?.address && shop.address.trim()) {
    const street = shop.address.split(',')[0].trim();
    if (street) return street;
  }
  if (shop?.city && shop.city.trim() && shop.city.toLowerCase() !== 'unknown') {
    return shop.city;
  }
  return "Indirizzo in aggiornamento";
}

