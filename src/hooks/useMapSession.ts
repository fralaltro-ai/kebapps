import { useCallback } from "react";

interface MapSessionState {
  center: google.maps.LatLngLiteral | null;
  zoom: number | null;
}

// Module-level singleton (RAM-only, zero security risk)
const mapSession: MapSessionState = { center: null, zoom: null };

export function clearMapSession(): void {
  mapSession.center = null;
  mapSession.zoom = null;
}

export function useMapSession() {
  const get = useCallback(() => mapSession, []);
  
  const save = useCallback((center: google.maps.LatLngLiteral, zoom: number) => {
    mapSession.center = center;
    mapSession.zoom = zoom;
  }, []);

  return { get, save };
}
