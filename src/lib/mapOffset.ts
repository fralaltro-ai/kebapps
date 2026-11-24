export interface CardPanInput {
  containerHeight: number;
  cardHeight: number;
  topOffset: number;        // searchTopOffset di KebabMap
  searchBarHeight?: number; // default 48 (h-12 di MapSearchBar)
  margin?: number;          // default 12
  tailGap?: number;         // default 24 (mb-6 del wrapper card)
}

/**
 * Computes the vertical pan offset (dy for map.panBy(0, dy)) required to ensure
 * that a shop card positioned above a marker does not overlap the top navigation / search bar.
 */
export function computeCardPanOffset(input: CardPanInput): number {
  const {
    containerHeight,
    cardHeight,
    topOffset,
    searchBarHeight = 48,
    margin = 12,
    tailGap = 24,
  } = input;

  if (
    !Number.isFinite(containerHeight) ||
    !Number.isFinite(cardHeight) ||
    !Number.isFinite(topOffset) ||
    containerHeight <= 0 ||
    cardHeight <= 0
  ) {
    return 0;
  }

  const safeTop = topOffset + searchBarHeight + margin;
  
  // dy calculation ensuring top of card is at or below safeTop
  let dy = Math.min(0, containerHeight / 2 - cardHeight - tailGap - safeTop);

  // Clamp dy so that the pin doesn't leave the viewport bottom (leaving at least 80px margin)
  const minDy = -(containerHeight / 2 - 80);
  if (minDy < 0) {
    dy = Math.max(dy, minDy);
  }

  return Math.round(dy);
}

/**
 * Computes a target LatLng coordinate offset by dyPixels vertically, using the
 * Google Maps Mercator projection. This allows executing a single atomic panTo
 * transition instead of a jerky two-step panTo + panBy sequence.
 */
export function computeOffsetLatLng(
  map: google.maps.Map,
  latLng: google.maps.LatLngLiteral,
  dyPixels: number
): google.maps.LatLngLiteral {
  if (dyPixels === 0 || !Number.isFinite(dyPixels)) {
    return latLng;
  }
  if (typeof google === "undefined" || !google?.maps) {
    return latLng;
  }
  const projection = map.getProjection();
  const zoom = map.getZoom();
  if (!projection || zoom === undefined || !Number.isFinite(zoom)) {
    return latLng;
  }
  const scale = Math.pow(2, zoom);
  const worldPoint = projection.fromLatLngToPoint(new google.maps.LatLng(latLng.lat, latLng.lng));
  if (!worldPoint) return latLng;

  const targetWorldY = worldPoint.y + (dyPixels / scale);
  const targetLatLng = projection.fromPointToLatLng(new google.maps.Point(worldPoint.x, targetWorldY));
  if (!targetLatLng) return latLng;

  return { lat: targetLatLng.lat(), lng: targetLatLng.lng() };
}

