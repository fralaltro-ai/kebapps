"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import KebabAdvancedMarker from "./KebabAdvancedMarker";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { X, LocateFixed, AlertTriangle, RotateCcw, ShieldCheck } from "lucide-react";
import { useCompass } from "@/hooks/useCompass";
import { hasGpsConsent, readGpsConsentStatus, useGpsConsent } from "@/hooks/useGpsConsent";
import { useTurnstile } from "@/hooks/useTurnstile";

import { 
  calculateHaversineDistance, 
  estimateTravelTime, 
  formatDistance,
  formatTime
} from "@/lib/geoUtils";
import { DynamicShopPin, type PersonalPinStatus } from "./map/DynamicShopPin";
import {
  useShopCache,
  expandBounds,
  mergeShopsById,
  EXPAND_PADDING_RATIO,
  INITIAL_EXPAND_PADDING_RATIO,
  DRILLDOWN_EXPAND_PADDING_RATIO,
  type ExpandedBounds,
  type KebabShop,
} from "@/hooks/useShopCache";
import {
  MIN_MAP_ZOOM,
  getSanitizedGoogleMapsApiKey,
  hasConfiguredGoogleMapsKey,
  resolveGoogleMapsMapId,
} from "@/lib/map-proxy-config";
import { SectionInfoButton } from "./ui/SectionInfoButton";
import { useMapSession } from "@/hooks/useMapSession";
import { useUserReviews } from "@/hooks/useUserReviews";
import { useUserWishlist } from "@/hooks/useUserWishlist";
import { useToast } from "@/context/ToastContext";
import { calculateReviewAverage } from "@/lib/ratingLabels";
import { GOOGLE_COORDS_TTL_MS, type DiaryEntryInput } from "@/lib/local-storage/schema";
import MapSearchBar from "./map/MapSearchBar";
import ShopInfoCard from "./map/ShopInfoCard";
import UnverifiedShopCard from "./map/UnverifiedShopCard";
import RoutingPanel from "./map/RoutingPanel";
import { GeoPermissionPrompt } from "./map/GeoPermissionPrompt";
import { MapLoadingScreen } from "./map/MapLoadingScreen";
import { MapAreaLoadingModal } from "./map/MapAreaLoadingModal";
import { ROUTE_STROKE } from "@/lib/mapTheme";
import ZeroCostLocalMapView from "./map/ZeroCostLocalMapView";

interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string | null;
  [key: string]: unknown;
}

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 41.9028,
  lng: 12.4964,
};

const baseMapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  rotateControl: false,
  headingInteractionEnabled: true,
  tiltInteractionEnabled: false,
  minZoom: MIN_MAP_ZOOM,
  maxZoom: 19,
  gestureHandling: "greedy" as const,
  clickableIcons: true,
};

const LIBRARIES: ("maps" | "marker" | "places")[] = ["maps", "marker", "places"];

interface MapSdkBoundaryProps {
  onFallbackToLocal: () => void;
  children: React.ReactNode;
}

interface MapSdkBoundaryState {
  error: Error | null;
}

/**
 * Local error boundary isolating Google Maps SDK / browser runtime failures so
 * `/map` degrades with an actionable recovery card instead of crashing the route.
 */
class MapSdkErrorBoundary extends React.Component<MapSdkBoundaryProps, MapSdkBoundaryState> {
  state: MapSdkBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): MapSdkBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[KebabMap] Interactive Google Map runtime error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <MapSdkFallbackCard
          message={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
          onUseLocalView={this.props.onFallbackToLocal}
        />
      );
    }
    return this.props.children;
  }
}

function MapSdkFallbackCard({
  message,
  onRetry,
  onUseLocalView,
}: {
  message?: string;
  onRetry: () => void;
  onUseLocalView: () => void;
}) {
  return (
    <div
      data-map-container
      className="w-full h-full overflow-y-auto app-scroll overscroll-contain flex flex-col bg-background text-foreground font-quicksand p-4 pb-[calc(var(--dock-space)+0.5rem)] sm:pb-4"
    >
      <div className="my-auto mx-auto bg-card rounded-3xl p-6 sm:p-8 max-w-md w-full border border-border shadow-dropdown text-center space-y-5">
        <div className="size-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto border border-destructive/20">
          <AlertTriangle className="size-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
            Mappa Google non disponibile
          </h2>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            Impossibile caricare o inizializzare Google Maps su questo dispositivo o dominio. Verifica la connessione o usa l&apos;esplorazione locale offline.
          </p>
          {message && (
            <p className="text-[11px] font-mono text-muted-foreground bg-muted/60 border border-border rounded-xl px-3 py-2 break-all">
              {message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="w-full bg-primary text-primary-foreground font-black py-3.5 px-6 rounded-2xl shadow-flat flat-press flex items-center justify-center gap-2 tracking-wide uppercase text-xs"
          >
            <RotateCcw className="size-4" />
            Riprova Google Maps
          </button>
          <button
            type="button"
            onClick={onUseLocalView}
            className="w-full py-2.5 px-4 bg-muted/60 hover:bg-muted text-foreground text-xs font-black uppercase tracking-wider rounded-xl border border-border transition-colors flat-press"
          >
            Usa Esplorazione Locale (Zero-Cost)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KebabMap() {
  const hasMapsKey = hasConfiguredGoogleMapsKey();
  const [forceLocalFallback, setForceLocalFallback] = useState(false);
  const {
    reviewsMap: userReviewsMap,
    setReviewForShop,
    removeReviewForShop,
  } = useUserReviews();
  const {
    wishlistMap: userWishlistMap,
    isInWishlist,
    toggleWishlistShop,
  } = useUserWishlist();
  const { success: toastSuccess, error: toastError } = useToast();

  const handleToggleWishlist = useCallback(
    async (shop: KebabShop, customLabel?: string) => {
      try {
        const isGoogle = shop.data_source === "google" || shop.data_source === "cache";
        const resolvedLabel = (customLabel ?? shop.name ?? "").trim();
        const added = await toggleWishlistShop({
          place_id: shop.place_id,
          name: resolvedLabel || undefined,
          latitude: shop.latitude,
          longitude: shop.longitude,
          coords_expires_at:
            isGoogle && shop.latitude !== null && shop.longitude !== null
              ? Date.now() + GOOGLE_COORDS_TTL_MS
              : null,
        });
        toastSuccess(added ? "Salvato in Wishlist!" : "Rimosso dalla Wishlist.");
      } catch {
        toastError("Impossibile aggiornare la Wishlist locale.");
      }
    },
    [toggleWishlistShop, toastSuccess, toastError]
  );

  const handleSaveDiaryReview = useCallback(
    async (shop: KebabShop, input: DiaryEntryInput) => {
      try {
        const isGoogle = shop.data_source === "google" || shop.data_source === "cache";
        const overall = Number(
          calculateReviewAverage({
            score_meat: input.score_meat,
            score_bread: input.score_bread,
            score_sauces: input.score_sauces,
            score_value: input.score_value,
            score_location: input.score_location ?? null,
          }).toFixed(2)
        );
        const nowIso = new Date().toISOString();
        const coordsExpiresAt =
          input.coords_expires_at !== undefined
            ? input.coords_expires_at
            : isGoogle && (input.latitude ?? null) !== null && (input.longitude ?? null) !== null
              ? Date.now() + GOOGLE_COORDS_TTL_MS
              : null;
        setReviewForShop(shop.place_id, {
          place_id: shop.place_id,
          shop_label: input.shop_label,
          city: input.city ?? null,
          country: input.country ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          coords_expires_at: coordsExpiresAt,
          score_overall: overall,
          score_meat: input.score_meat,
          score_bread: input.score_bread,
          score_sauces: input.score_sauces,
          score_value: input.score_value,
          score_location: input.score_location ?? null,
          note: input.note ?? "",
          visited_at: input.visited_at ?? nowIso,
          created_at: nowIso,
        });
        toastSuccess("Salvato nel tuo Diario personale!");
      } catch {
        toastError("Impossibile salvare nel Diario locale.");
      }
    },
    [setReviewForShop, toastSuccess, toastError]
  );

  const resolvedMapId = resolveGoogleMapsMapId();

  if (!hasMapsKey || forceLocalFallback) {
    return (
      <ZeroCostLocalMapView
        userReviewsMap={userReviewsMap}
        isInWishlist={isInWishlist}
        onToggleWishlist={handleToggleWishlist}
        userLocation={null}
      />
    );
  }

  if (!resolvedMapId) {
    return (
      <MapSdkFallbackCard
        message="Map ID Google Maps di produzione non configurato (DEMO_MAP_ID è consentito solo in test locale)."
        onRetry={() => window.location.reload()}
        onUseLocalView={() => setForceLocalFallback(true)}
      />
    );
  }

  return (
    <MapSdkErrorBoundary onFallbackToLocal={() => setForceLocalFallback(true)}>
      <InteractiveGoogleKebabMap
        mapId={resolvedMapId}
        userReviewsMap={userReviewsMap}
        userWishlistMap={userWishlistMap}
        isInWishlist={isInWishlist}
        onToggleWishlist={handleToggleWishlist}
        onSaveDiaryReview={handleSaveDiaryReview}
        removeReviewForShop={removeReviewForShop}
        onFallbackToLocal={() => setForceLocalFallback(true)}
      />
    </MapSdkErrorBoundary>
  );
}

interface InteractiveGoogleKebabMapProps {
  mapId: string;
  userReviewsMap: ReturnType<typeof useUserReviews>["reviewsMap"];
  userWishlistMap: ReturnType<typeof useUserWishlist>["wishlistMap"];
  isInWishlist: ReturnType<typeof useUserWishlist>["isInWishlist"];
  onToggleWishlist: (shop: KebabShop, customLabel?: string) => Promise<void>;
  onSaveDiaryReview: (shop: KebabShop, input: DiaryEntryInput) => Promise<void>;
  removeReviewForShop: ReturnType<typeof useUserReviews>["removeReviewForShop"];
  onFallbackToLocal: () => void;
}

function InteractiveGoogleKebabMap({
  mapId,
  userReviewsMap,
  userWishlistMap,
  isInWishlist,
  onToggleWishlist: handleToggleWishlist,
  onSaveDiaryReview: handleSaveDiaryReview,
  removeReviewForShop,
  onFallbackToLocal,
}: InteractiveGoogleKebabMapProps) {
  const { resolvedTheme } = useTheme();

  const loaderConfig = React.useMemo(() => ({
    id: "google-map-script",
    googleMapsApiKey: getSanitizedGoogleMapsApiKey(),
    version: "weekly",
    libraries: LIBRARIES,
    mapIds: [mapId],
  }), [mapId]);

  const currentMapOptions = React.useMemo(() => ({
    ...baseMapOptions,
    mapId,
    colorScheme: resolvedTheme === "dark" ? "DARK" : "LIGHT",
  }), [mapId, resolvedTheme]);

  const [sdkAuthError, setSdkAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as Window & { gm_authFailure?: () => void };
    const previousHandler = win.gm_authFailure;
    const authFailureHandler = () => {
      console.error("[KebabMap] Google Maps authentication failed (gm_authFailure).");
      setSdkAuthError("Autenticazione Google Maps rifiutata (API key non valida o dominio non autorizzato).");
      if (typeof previousHandler === "function" && previousHandler !== authFailureHandler) {
        previousHandler();
      }
    };
    win.gm_authFailure = authFailureHandler;
    return () => {
      if (win.gm_authFailure === authFailureHandler) {
        if (previousHandler) {
          win.gm_authFailure = previousHandler;
        } else {
          delete win.gm_authFailure;
        }
      }
    };
  }, []);

  const { isLoaded, loadError } = useJsApiLoader(loaderConfig);
  const { success: toastSuccess } = useToast();
  const { shouldFetch: shouldFetchShops, isSaturatedDrilldown, getCachedShops, setCache } = useShopCache({
    onHydrated: (hydrated) => {
      if (hydrated.length > 0) {
        setShops((prev) => mergeShopsById(prev, hydrated));
      }
    },
  });
  const { get: getMapSession, save: saveMapSession } = useMapSession();
  const { compassRef, mapHeadingRef, requestPermission } = useCompass();
  const containerRef = useRef<HTMLDivElement>(null);

  // COMP-AUDIT-D1: sessionStorage only, never localStorage — matches the retention
  // COOKIE_POLICY.md declares ("cancellata automaticamente alla chiusura della scheda").
  const getInitialPosition = (): google.maps.LatLngLiteral | null => {
    if (typeof window === "undefined" || !hasGpsConsent()) return null;
    try {
      const cachedSession = sessionStorage.getItem("kebapp_last_user_pos");
      if (cachedSession) {
        const parsed = JSON.parse(cachedSession);
        if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [shops, setShops] = useState<KebabShop[]>(() => getCachedShops());
  const [selectedShop, setSelectedShop] = useState<KebabShop | null>(null);
  const [loadingShops, setLoadingShops] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  // Dedicated invisible "execute"-mode widgets for on-submit geocoding and viewport shop proxy.
  const geocodeTurnstile = useTurnstile({ action: "geocode_search", execution: "execute" });
  const shopsTurnstile = useTurnstile({ action: "shops_search", execution: "execute" });
  const shopsTurnstileExecuteRef = useRef(shopsTurnstile.execute);
  shopsTurnstileExecuteRef.current = shopsTurnstile.execute;
  const shopsTurnstileResetRef = useRef(shopsTurnstile.reset);
  shopsTurnstileResetRef.current = shopsTurnstile.reset;
  const unusedShopsTokenRef = useRef<{ token: string; ts: number } | null>(null);
  const shopsTokenInFlightRef = useRef<Promise<string> | null>(null);

  const consumeShopsTurnstileToken = useCallback(async (): Promise<{
    token: string;
    usedCached: boolean;
  }> => {
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      return {
        token: process.env.NODE_ENV !== "production" ? "dev-turnstile-bypass" : "",
        usedCached: false,
      };
    }

    if (shopsTokenInFlightRef.current) {
      await shopsTokenInFlightRef.current.catch(() => {});
    }

    const cachedToken = unusedShopsTokenRef.current;
    if (cachedToken && Date.now() - cachedToken.ts < 120_000) {
      unusedShopsTokenRef.current = null;
      return { token: cachedToken.token, usedCached: true };
    }
    unusedShopsTokenRef.current = null;

    const mintPromise = shopsTurnstileExecuteRef
      .current()
      .catch(() => (process.env.NODE_ENV !== "production" ? "dev-turnstile-bypass" : ""));
    shopsTokenInFlightRef.current = mintPromise;
    try {
      const token = await mintPromise;
      return { token, usedCached: false };
    } finally {
      if (shopsTokenInFlightRef.current === mintPromise) {
        shopsTokenInFlightRef.current = null;
      }
    }
  }, []);

  const restoreUnusedShopsToken = useCallback((token: string) => {
    if (!token || token === "dev-turnstile-bypass") return;
    unusedShopsTokenRef.current = { token, ts: Date.now() };
  }, []);

  const getGeocodeTurnstileToken = useCallback(async (): Promise<string> => {
    if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      if (process.env.NODE_ENV !== "production") {
        return "dev-turnstile-bypass";
      }
      throw new Error("Turnstile non configurato.");
    }
    try {
      return await geocodeTurnstile.execute();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        return "dev-turnstile-bypass";
      }
      throw err;
    }
  }, [geocodeTurnstile]);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(getInitialPosition);
  const searchParams = useSearchParams();
  const paramLat = searchParams?.get("lat") ?? null;
  const paramLng = searchParams?.get("lng") ?? null;
  const paramShopId = searchParams?.get("shopId") ?? null;

  const hasValidParams = React.useMemo(() => {
    if (!paramLat || !paramLng) return false;
    const lat = parseFloat(paramLat);
    const lng = parseFloat(paramLng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }, [paramLat, paramLng]);

  // On a first-ever visit there is no cached position and no ?lat/lng param: only wait
  // briefly for the GPS fix if GPS consent was already granted, otherwise load pins at once.
  const [awaitingInitialFix, setAwaitingInitialFix] = useState(
    () => !hasValidParams && !getInitialPosition() && hasGpsConsent()
  );
  const awaitingInitialFixRef = useRef(awaitingInitialFix);
  awaitingInitialFixRef.current = awaitingInitialFix;

  const [initialViewportReady, setInitialViewportReady] = useState(false);
  const initialViewportReadyRef = useRef(false);

  const hasUserPanned = useRef(false);
  const isInitialCenterSet = useRef(false);
  const initialPosRef = useRef<google.maps.LatLngLiteral | null>(getInitialPosition());
  const pendingInitialGpsCenterRef = useRef<google.maps.LatLngLiteral | null>(null);
  const skipMountEffectFetchRef = useRef(false);
  const userLocationRef = useRef<google.maps.LatLngLiteral | null>(userLocation);
  userLocationRef.current = userLocation;

  const pendingAreaFetchRef = useRef(false);

  const [initialMapCenter] = useState<google.maps.LatLngLiteral>(() => {
    if (hasValidParams) {
      return { lat: parseFloat(paramLat!), lng: parseFloat(paramLng!) };
    }
    const sessionCenter = getMapSession().center;
    if (sessionCenter && Number.isFinite(sessionCenter.lat) && Number.isFinite(sessionCenter.lng)) {
      return sessionCenter;
    }
    const initialPos = getInitialPosition();
    if (initialPos) {
      return initialPos;
    }
    return defaultCenter;
  });
  const hasSavedSessionCenterRef = useRef(Boolean(getMapSession().center));

  const updateUserPos = useCallback((lat: number, lng: number) => {
    if (!hasGpsConsent() || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const pos = { lat, lng };
    try {
      // COMP-AUDIT-D1: sessionStorage only — see getInitialPosition above.
      sessionStorage.setItem("kebapp_last_user_pos", JSON.stringify(pos));
    } catch {
      // ignore
    }

    const prevLoc = userLocationRef.current;
    const movedSignificantly =
      !prevLoc || calculateHaversineDistance(prevLoc, pos) >= 0.005;

    if (movedSignificantly || awaitingInitialFixRef.current) {
      setUserLocation(pos);
      setLocationError(null);
    }
    setAwaitingInitialFix(false);

    // Center map on user's GPS position AT MOST ONCE per mount before user pans.
    if (!hasValidParams && !hasUserPanned.current && !isInitialCenterSet.current) {
      isInitialCenterSet.current = true;
      const currentMap = mapRef.current;
      if (currentMap) {
        const cur = currentMap.getCenter();
        const distFromCurrentCenterKm = cur
          ? calculateHaversineDistance({ lat: cur.lat(), lng: cur.lng() }, pos)
          : Infinity;
        if (distFromCurrentCenterKm > 0.1) {
          skipMountEffectFetchRef.current = true;
          if (!initialViewportReadyRef.current) {
            currentMap.setCenter(pos);
          } else {
            currentMap.panTo(pos);
          }
        }
      } else {
        pendingInitialGpsCenterRef.current = pos;
      }
    }
  }, [hasValidParams]);

  const [zoom] = useState(() => getMapSession().zoom || 14);

  useEffect(() => {
    if (map && hasValidParams) {
      const lat = parseFloat(paramLat!);
      const lng = parseFloat(paramLng!);
      isInitialCenterSet.current = true;
      map.moveCamera({ center: { lat, lng }, zoom: 17 });
    }
  }, [map, hasValidParams, paramLat, paramLng]);

  const lastSelectedShopId = useRef<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchTopOffset, setSearchTopOffset] = useState(16); 
  const hasFetchedOnMount = useRef(false);
  const emptyRetryCount = useRef<Map<string, number>>(new Map());
  const emptyRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failedBoundsCooldownRef = useRef<Map<string, number>>(new Map());
  const globalRateLimitUntilRef = useRef<number>(0);
  const recentNetworkFetchesRef = useRef<number[]>([]);
  
  const [isAreaLoading, setIsAreaLoading] = useState(false);
  const areaLoadingWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPannedTargetIdRef = useRef<string | null>(null);
  const cardPanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failSafeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialOverlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const awaitingFixTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isRoutingActive, setIsRoutingActive] = useState(false);
  const [routingDestination, setRoutingDestination] = useState<KebabShop | null>(null);
  const [travelMode, setTravelMode] = useState<"DRIVING" | "WALKING">("DRIVING");
  const [routingInfo, setRoutingInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routingPath, setRoutingPath] = useState<google.maps.LatLngLiteral[]>([]);
  const routingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const preRoutingState = useRef<{ center: google.maps.LatLng | undefined; zoom: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showDisambiguationModal, setShowDisambiguationModal] = useState(false);

  const { status: gpsConsentStatus, grantGpsConsent, denyGpsConsent } = useGpsConsent();
  const [showGeoPrompt, setShowGeoPrompt] = useState(false);
  
  const startTracking = useCallback((options?: { forcePrompt?: boolean }) => {
    // Check for explicit consent in localStorage
    const consent = readGpsConsentStatus();
    
    // Se il consenso è stato negato in precedenza, non disturbare l'utente al mount della mappa (Caso 2: Mappa ON / GPS OFF)
    // Mostrare il prompt solo su azione esplicita (click su Locate o Riprova)
    if (consent === "denied" && !options?.forcePrompt) {
      return;
    }

    if (consent !== "granted") {
      setShowGeoPrompt(true);
      return;
    }

    if (promptTimeoutRef.current) {
      clearTimeout(promptTimeoutRef.current);
      promptTimeoutRef.current = null;
    }
    
    promptTimeoutRef.current = setTimeout(() => {
      setLocationError("In attesa del consenso GPS... Controlla il popup del browser.");
    }, 5000);

    if (navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      // Tier 1: Fast Immediate Coarse/Network/Cached Fix (<300ms)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (promptTimeoutRef.current) {
            clearTimeout(promptTimeoutRef.current);
            promptTimeoutRef.current = null;
          }
          updateUserPos(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Coarse timeout or fallback, watchPosition will handle fine fix
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 4000 }
      );

      // Tier 2: Continuous High-Accuracy GPS Tracking (debounced with maximumAge: 5000)
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (promptTimeoutRef.current) {
            clearTimeout(promptTimeoutRef.current);
            promptTimeoutRef.current = null;
          }
          updateUserPos(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          if (promptTimeoutRef.current) {
            clearTimeout(promptTimeoutRef.current);
            promptTimeoutRef.current = null;
          }
          if (err.code === err.PERMISSION_DENIED) {
            setLocationError("Hai negato l'accesso alla posizione GPS. Abilitalo nelle impostazioni del browser.");
          } else {
            setLocationError("Impossibile rilevare la posizione GPS.");
          }
        },
        { timeout: 30000, enableHighAccuracy: true, maximumAge: 5000 }
      );
    } else {
      setLocationError("Il tuo browser non supporta la geolocalizzazione.");
    }
  }, [updateUserPos]);

  const handleGeoAccept = useCallback(() => {
    grantGpsConsent();
    setShowGeoPrompt(false);
    setLocationError(null);
    void requestPermission();
    startTracking({ forcePrompt: true });
  }, [grantGpsConsent, requestPermission, startTracking]);

  const handleGeoDecline = useCallback(() => {
    denyGpsConsent();
    setShowGeoPrompt(false);
    setLocationError("Geolocalizzazione disattivata. Clicca su 'Localizzami' per attivarla.");
  }, [denyGpsConsent]);

  const handleLocateClick = useCallback(async () => {
    hasUserPanned.current = false;
    setSelectedShop(null);
    setUnverifiedPlace(null);
    if (!hasGpsConsent()) {
      setShowGeoPrompt(true);
      return;
    }

    // 1. Center map on user if available
    if (userLocation && map) {
      map.panTo(userLocation);
      map.setZoom(16);
    }
    
    // 2. Request Compass permission (mandatory interaction for iOS)
    await requestPermission();
    
    // 3. Restart tracking if it was lost
    startTracking({ forcePrompt: true });
  }, [userLocation, map, requestPermission, startTracking]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('heading_changed', () => {
      if (mapHeadingRef) {
        mapHeadingRef.current = map.getHeading() || 0;
      }
    });
    return () => listener.remove();
  }, [map, mapHeadingRef]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const focusArea = useCallback((loc: google.maps.LatLngLiteral, zoomLevel: number) => {
    if (!map) return;
    const cur = map.getCenter();
    const sameArea = Boolean(
      cur &&
        Math.abs(cur.lat() - loc.lat) < 0.0001 &&
        Math.abs(cur.lng() - loc.lng) < 0.0001 &&
        map.getZoom() === zoomLevel
    );
    hasUserPanned.current = true;
    isInitialCenterSet.current = true;
    map.moveCamera({ center: loc, zoom: zoomLevel });
    if (sameArea) {
      pendingAreaFetchRef.current = false;
      setIsAreaLoading(false);
      return;
    }
    pendingAreaFetchRef.current = true;
    setIsAreaLoading(true);

    if (areaLoadingWatchdogRef.current) {
      clearTimeout(areaLoadingWatchdogRef.current);
    }
    areaLoadingWatchdogRef.current = setTimeout(() => {
      setIsAreaLoading(false);
      pendingAreaFetchRef.current = false;
    }, 8000);
  }, [map]);

  const handleSelectResult = useCallback((place: GeocodeResult) => {
    if (!map) return;
    const loc = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
    focusArea(loc, 15);
    setShowDisambiguationModal(false);
    setSearchResults([]);
    setSearchQuery("");
  }, [map, focusArea]);

  const handleSearchSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !map || !window.google) return;

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    const abortController = new AbortController();
    searchAbortRef.current = abortController;

    searchTimeoutRef.current = setTimeout(() => {
      abortController.abort();
    }, 8000);

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setShowDisambiguationModal(false);

    let sawRateLimit = false;
    let sawServerError = false;

    try {
      // Step 1: Query Google Geocoding API for place / address matching
      try {
        const geoToken = await getGeocodeTurnstileToken();
        const geoRes = await fetch(`/api/geocode-search?q=${encodeURIComponent(searchQuery.trim())}`, {
          signal: abortController.signal,
          headers: { "x-turnstile-token": geoToken },
        });
        if (geoRes.ok) {
          const geoJson = await geoRes.json();
          const geoData = geoJson.results || geoJson;
          if (geoData && Array.isArray(geoData) && geoData.length > 0) {
            if (geoData.length === 1 || !geoData[0].display_name) {
              handleSelectResult(geoData[0]);
              return;
            } else {
              setSearchResults(geoData);
              setShowDisambiguationModal(true);
              return;
            }
          }
        } else if (geoRes.status === 429) {
          sawRateLimit = true;
        } else if (geoRes.status >= 500) {
          sawServerError = true;
        }
      } catch (geoError: unknown) {
        if (geoError instanceof Error && geoError.name === "AbortError") throw geoError;
        console.error("Geocode search turnstile/network error:", geoError);
      }

      // Step 2: Local fallback across user diary / wishlist / fixture shops, or bounded proxy search
      const normalizedQ = searchQuery.trim().toLowerCase();
      const localReviewMatch = Array.from(userReviewsMap.values()).find(
        (r) =>
          r.latitude !== null &&
          r.latitude !== undefined &&
          r.longitude !== null &&
          r.longitude !== undefined &&
          ((r.shop_label?.toLowerCase().includes(normalizedQ) ?? false) ||
            (r.city?.toLowerCase().includes(normalizedQ) ?? false))
      );
      if (localReviewMatch) {
        focusArea({ lat: localReviewMatch.latitude!, lng: localReviewMatch.longitude! }, 16);
        const matchingShop = shops.find((s) => s.place_id === localReviewMatch.place_id);
        if (matchingShop) setSelectedShop(matchingShop);
        return;
      }
      const localMatch = shops.find(
        (s) =>
          s.latitude !== null &&
          s.longitude !== null &&
          ((s.name?.toLowerCase().includes(normalizedQ) ?? false) ||
            (s.address?.toLowerCase().includes(normalizedQ) ?? false) ||
            (s.city?.toLowerCase().includes(normalizedQ) ?? false))
      );
      if (localMatch) {
        focusArea({ lat: localMatch.latitude!, lng: localMatch.longitude! }, 16);
        setSelectedShop(localMatch);
        return;
      }

      const currentBounds = map.getBounds();
      if (currentBounds) {
        const expanded = expandBounds(currentBounds);
        const { token: shopsToken } = await consumeShopsTurnstileToken();
        if (shopsToken) {
          const currentZoom = Math.max(13, Math.round(map.getZoom() || 14));
          const dbRes = await fetch(
            `/api/shops?q=${encodeURIComponent(searchQuery.trim())}&northeastLat=${expanded.neLat}&northeastLng=${expanded.neLng}&southwestLat=${expanded.swLat}&southwestLng=${expanded.swLng}&zoom=${currentZoom}`,
            {
              signal: abortController.signal,
              headers: { "x-turnstile-token": shopsToken },
            }
          );
          if (dbRes.ok) {
            const dbData = await dbRes.json();
            if (dbData.shops && dbData.shops.length > 0) {
              const shopWithCoords = dbData.shops.find((s: KebabShop) => s.latitude !== null && s.longitude !== null);
              if (shopWithCoords) {
                const loc = { lat: shopWithCoords.latitude!, lng: shopWithCoords.longitude! };
                focusArea(loc, 16);
                setSelectedShop(shopWithCoords);
                return;
              }
            }
          } else if (dbRes.status === 429) {
            sawRateLimit = true;
          } else if (dbRes.status >= 500) {
            sawServerError = true;
          }
        }
      }

      if (sawRateLimit) {
        setSearchError("Troppe richieste, riprova tra poco.");
      } else if (sawServerError) {
        setSearchError("Errore del server. Riprova più tardi.");
      } else {
        setSearchError("Nessun luogo trovato.");
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Search error:", error);
      setSearchError("Errore durante la ricerca del luogo.");
    } finally {
      if (searchAbortRef.current === abortController) {
        setIsSearching(false);
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
      }
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSearchError(null);
  };

  const [unverifiedPlace, setUnverifiedPlace] = useState<{placeId: string, latLng: google.maps.LatLngLiteral} | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inFlightExpandedBoundsRef = useRef<ExpandedBounds | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent & { placeId?: string }) => {
    hasUserPanned.current = true;
    isInitialCenterSet.current = true;
    if (e.placeId) {
      e.stop(); 
      setUnverifiedPlace({
        placeId: e.placeId,
        latLng: { lat: e.latLng!.lat(), lng: e.latLng!.lng() }
      });
      setSelectedShop(null);
    } else {
      setSelectedShop(null);
      setUnverifiedPlace(null);
    }
  }, []);

  const calculateRouteInfo = useCallback((shop: KebabShop, mode: "WALKING" | "DRIVING") => {
    if (userLocation && shop.latitude !== null && shop.longitude !== null) {
      const distKm = calculateHaversineDistance(
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: shop.latitude, lng: shop.longitude }
      );
      const durationMin = estimateTravelTime(distKm, mode === "WALKING" ? "walking" : "driving");
      
      const distanceText = formatDistance(distKm);
      const durationText = formatTime(durationMin);
      
      setRoutingInfo({ distance: distanceText, duration: durationText });
      // Straight "linea d'aria" — 2 points
      setRoutingPath([
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: shop.latitude, lng: shop.longitude }
      ]);

      if (map) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(userLocation);
        bounds.extend({ lat: shop.latitude, lng: shop.longitude });
        map.fitBounds(bounds, { top: 80, bottom: 280, left: 50, right: 50 });
        if (window.google?.maps) {
          google.maps.event.addListenerOnce(map, "idle", () => {
            const z = map.getZoom();
            if (z !== undefined && z < MIN_MAP_ZOOM) {
              map.setZoom(MIN_MAP_ZOOM);
            }
          });
        }
      }
    }
  }, [userLocation, map]);

  const startRouting = useCallback((shop: KebabShop) => {
    if (map && !isRoutingActive) {
      preRoutingState.current = {
        center: map.getCenter() || undefined,
        zoom: map.getZoom() || 14
      };
    }
    setRoutingInfo(null);
    setRoutingDestination(shop);
    setIsRoutingActive(true);
    setSelectedShop(null); 
    calculateRouteInfo(shop, travelMode);
  }, [map, isRoutingActive, calculateRouteInfo, travelMode]);

  const cancelRouting = useCallback(() => {
    if (routingPolylineRef.current) {
      routingPolylineRef.current.setMap(null);
      routingPolylineRef.current = null;
    }

    setIsRoutingActive(false);
    setRoutingInfo(null);
    setRoutingPath([]);
    
    if (map && preRoutingState.current) {
      if (preRoutingState.current.center) {
        map.panTo(preRoutingState.current.center);
      }
      map.setZoom(preRoutingState.current.zoom);
    } else if (map && routingDestination && routingDestination.latitude !== null && routingDestination.longitude !== null) {
      map.panTo({ lat: routingDestination.latitude, lng: routingDestination.longitude });
      map.setZoom(16);
    }
    
    preRoutingState.current = null;

    if (routingDestination) {
      setSelectedShop(routingDestination);
      setRoutingDestination(null);
    }
  }, [map, routingDestination]);

  useEffect(() => {
    startTracking();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startTracking]);

  useEffect(() => {
    if (gpsConsentStatus === "denied" || gpsConsentStatus === "pending") {
      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
        promptTimeoutRef.current = null;
      }
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      initialPosRef.current = null;
      pendingInitialGpsCenterRef.current = null;
      setUserLocation(null);
      setAwaitingInitialFix(false);
      if (isRoutingActive) {
        cancelRouting();
      }
    }
  }, [gpsConsentStatus, isRoutingActive, cancelRouting]);

  useEffect(() => {
    if (isRoutingActive && routingDestination && userLocation && routingDestination.latitude !== null && routingDestination.longitude !== null) {
      const distKm = calculateHaversineDistance(
        { lat: userLocation.lat, lng: userLocation.lng },
        { lat: routingDestination.latitude, lng: routingDestination.longitude }
      );
      if (distKm < 0.025) { 
        cancelRouting();
      }
    }
  }, [userLocation, isRoutingActive, routingDestination, cancelRouting]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    if (routingPolylineRef.current) {
      routingPolylineRef.current.setMap(null);
      routingPolylineRef.current = null;
    }

    if (isRoutingActive && routingPath.length > 0) {
      const polyline = new window.google.maps.Polyline({
        path: routingPath,
        strokeColor: ROUTE_STROKE,
        strokeOpacity: 0,
        strokeWeight: 0,
        zIndex: 50,
        clickable: false,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 1,
              strokeColor: ROUTE_STROKE,
              strokeWeight: 3,
              scale: 4,
            },
            offset: "0",
            repeat: "16px",
          },
        ],
        map,
      });
      routingPolylineRef.current = polyline;
    }

    return () => {
      if (routingPolylineRef.current) {
        routingPolylineRef.current.setMap(null);
        routingPolylineRef.current = null;
      }
    };
  }, [map, isRoutingActive, routingPath]);

  const fetchShops = useCallback(async (
    viewportBounds: google.maps.LatLngBounds,
    options?: { bypassCache?: boolean; isAreaFocus?: boolean; isInitialFetch?: boolean }
  ) => {
    if (!viewportBounds || typeof viewportBounds.getNorthEast !== 'function') {
      console.warn("fetchShops called with invalid bounds");
      return;
    }

    if (emptyRetryTimeoutRef.current) {
      clearTimeout(emptyRetryTimeoutRef.current);
      emptyRetryTimeoutRef.current = null;
    }

    const bypassCache = options?.bypassCache ?? false;
    const isAreaFocus = options?.isAreaFocus ?? false;
    const isInitialFetch = options?.isInitialFetch ?? false;
    const zoomLevel = Math.max(13, Math.round(mapRef.current?.getZoom() || 14));

    const finishAreaFocus = () => {
      if (!initialViewportReadyRef.current) {
        initialViewportReadyRef.current = true;
        setInitialViewportReady(true);
      }
      if (isAreaFocus) {
        setIsAreaLoading(false);
        if (areaLoadingWatchdogRef.current) {
          clearTimeout(areaLoadingWatchdogRef.current);
          areaLoadingWatchdogRef.current = null;
        }
      }
    };

    // SICUREZZA: Controlla cache prima del fetch di rete (anche quando una regione valida ha 0 locali)
    if (!bypassCache && !shouldFetchShops(viewportBounds, zoomLevel)) {
      const cached = getCachedShops();
      if (cached.length > 0) {
        setShops((prev) => mergeShopsById(prev, cached));
      }
      finishAreaFocus();
      return;
    }

    // Skip duplicate fetch if an active request already covers this viewport.
    const ne = viewportBounds.getNorthEast();
    const sw = viewportBounds.getSouthWest();
    const inFlight = inFlightExpandedBoundsRef.current;
    if (
      !bypassCache &&
      !isAreaFocus &&
      inFlight &&
      sw.lat() >= inFlight.swLat &&
      sw.lng() >= inFlight.swLng &&
      ne.lat() <= inFlight.neLat &&
      ne.lng() <= inFlight.neLng
    ) {
      return;
    }

    // Apply minimal marker-edge buffer and 0.005° privacy grid quantization to current viewport
    const paddingRatio =
      isInitialFetch || isAreaFocus
        ? INITIAL_EXPAND_PADDING_RATIO
        : isSaturatedDrilldown(viewportBounds, zoomLevel)
          ? DRILLDOWN_EXPAND_PADDING_RATIO
          : EXPAND_PADDING_RATIO;
    const expanded = expandBounds(viewportBounds, paddingRatio);
    const boundsKey = `${expanded.swLat.toFixed(3)}_${expanded.swLng.toFixed(3)}_${expanded.neLat.toFixed(3)}_${expanded.neLng.toFixed(3)}_z${zoomLevel}`;
    const now = Date.now();

    if (!bypassCache && !isAreaFocus) {
      if (now < globalRateLimitUntilRef.current) {
        finishAreaFocus();
        return;
      }
      const cooldownUntil = failedBoundsCooldownRef.current.get(boundsKey) ?? 0;
      if (now < cooldownUntil) {
        finishAreaFocus();
        return;
      }
      recentNetworkFetchesRef.current = recentNetworkFetchesRef.current.filter(
        (ts) => now - ts < 60_000
      );
      if (recentNetworkFetchesRef.current.length >= 12) {
        console.warn("[KebabMap] Automatic shop fetch budget exceeded (12/min); pausing background fetches.");
        finishAreaFocus();
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    inFlightExpandedBoundsRef.current = expanded;

    const scheduleAreaRetry = (key: string, delayMs: number, maxRetries: number) => {
      if (emptyRetryCount.current.size > 50) emptyRetryCount.current.clear();
      const retries = emptyRetryCount.current.get(key) || 0;
      if (retries >= maxRetries) return false;
      emptyRetryCount.current.set(key, retries + 1);
      if (emptyRetryTimeoutRef.current) clearTimeout(emptyRetryTimeoutRef.current);
      const scheduledCenter = mapRef.current?.getCenter();
      emptyRetryTimeoutRef.current = setTimeout(() => {
        const currentMap = mapRef.current;
        if (!currentMap) return;
        const currentCenter = currentMap.getCenter();
        if (
          scheduledCenter &&
          currentCenter &&
          (Math.abs(currentCenter.lat() - scheduledCenter.lat()) > 0.005 ||
            Math.abs(currentCenter.lng() - scheduledCenter.lng()) > 0.005)
        ) {
          return;
        }
        const currentBounds = currentMap.getBounds();
        if (currentBounds) {
          void fetchShops(currentBounds, { bypassCache: true });
        }
      }, delayMs);
      return true;
    };

    setLoadingShops(true);
    let consumedToken = "";
    let fetchStarted = false;
    try {
      const { token: turnstileToken } = await consumeShopsTurnstileToken();
      consumedToken = turnstileToken;
      if (abortController.signal.aborted) {
        restoreUnusedShopsToken(turnstileToken);
        return;
      }
      if (!turnstileToken) {
        failedBoundsCooldownRef.current.set(boundsKey, Date.now() + 20_000);
        scheduleAreaRetry(boundsKey, 2000, 1);
        return;
      }

      fetchStarted = true;
      recentNetworkFetchesRef.current.push(Date.now());
      const response = await fetch(
        `/api/shops?northeastLat=${expanded.neLat}&northeastLng=${expanded.neLng}&southwestLat=${expanded.swLat}&southwestLng=${expanded.swLng}&zoom=${zoomLevel}`,
        {
          signal: abortController.signal,
          headers: {
            "x-turnstile-token": turnstileToken,
          },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          shops?: KebabShop[];
          source?: string;
          saturated?: boolean;
        };
        const fetchedShops = data.shops || [];

        if (data.source === "google_error") {
          failedBoundsCooldownRef.current.set(boundsKey, Date.now() + 20_000);
          scheduleAreaRetry(boundsKey, 2500, 1);
        } else {
          setCache(expanded, fetchedShops, {
            zoom: zoomLevel,
            saturated: Boolean(data.saturated) || fetchedShops.length >= 20,
          });
          setShops((prev) => mergeShopsById(mergeShopsById(prev, getCachedShops()), fetchedShops));
        }

        if (!initialViewportReadyRef.current) {
          initialViewportReadyRef.current = true;
          setInitialViewportReady(true);
        }
      } else if (response.status === 429) {
        console.warn("[KebabMap] Shops fetch rate-limited (429); cooling down for 30s.");
        globalRateLimitUntilRef.current = Date.now() + 30_000;
      } else if (response.status === 400) {
        console.warn("[KebabMap] Shops fetch rejected (400); cooling down bounds.");
        failedBoundsCooldownRef.current.set(boundsKey, Date.now() + 30_000);
      } else if (response.status === 403) {
        console.warn("[KebabMap] Shops fetch Turnstile rejected (403); resetting widget.");
        shopsTurnstileResetRef.current();
        const scheduled = scheduleAreaRetry(boundsKey, 1500, 1);
        if (!scheduled) {
          failedBoundsCooldownRef.current.set(boundsKey, Date.now() + 20_000);
        }
      } else {
        if (response.status >= 500) {
          console.error(`[KebabMap] Shops fetch server error: HTTP ${response.status}`);
        } else {
          console.warn(`[KebabMap] Failed to fetch shops: HTTP ${response.status}`);
        }
        const scheduled = scheduleAreaRetry(boundsKey, 2500, 1);
        if (!scheduled) {
          failedBoundsCooldownRef.current.set(boundsKey, Date.now() + 20_000);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        if (!fetchStarted && consumedToken) {
          restoreUnusedShopsToken(consumedToken);
        }
        return;
      }
      console.error("Failed to fetch shops:", error);
      if (!initialViewportReadyRef.current) {
        initialViewportReadyRef.current = true;
        setInitialViewportReady(true);
      }
      const scheduled = scheduleAreaRetry(boundsKey, 2500, 1);
      if (!scheduled) {
        failedBoundsCooldownRef.current.set(boundsKey, Date.now() + 20_000);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        inFlightExpandedBoundsRef.current = null;
        setLoadingShops(false);
        if (!initialViewportReadyRef.current && !abortController.signal.aborted) {
          initialViewportReadyRef.current = true;
          setInitialViewportReady(true);
        }
      }
      if (isAreaFocus) {
        setIsAreaLoading(false);
        if (areaLoadingWatchdogRef.current) {
          clearTimeout(areaLoadingWatchdogRef.current);
          areaLoadingWatchdogRef.current = null;
        }
      }
    }
  }, [shouldFetchShops, isSaturatedDrilldown, getCachedShops, setCache, consumeShopsTurnstileToken, restoreUnusedShopsToken]);

  const handleDeleteDiaryReview = useCallback(
    (placeId: string) => {
      removeReviewForShop(placeId);
      toastSuccess("Voce rimossa dal Diario.");
    },
    [removeReviewForShop, toastSuccess]
  );

  const isMapFullyReady = isLoaded && Boolean(map) && !awaitingInitialFix && initialViewportReady;

  useEffect(() => {
    if (isMapFullyReady) {
      setIsInitialLoading(false);
      if (initialOverlayTimerRef.current) clearTimeout(initialOverlayTimerRef.current);
      initialOverlayTimerRef.current = setTimeout(() => setShowOverlay(false), 300);
    }
  }, [isMapFullyReady]);

  useEffect(() => {
    failSafeTimerRef.current = setTimeout(() => {
      setAwaitingInitialFix(false);
      setInitialViewportReady(true);
      initialViewportReadyRef.current = true;
      setIsInitialLoading(false);
      if (initialOverlayTimerRef.current) clearTimeout(initialOverlayTimerRef.current);
      initialOverlayTimerRef.current = setTimeout(() => setShowOverlay(false), 300);
    }, 6500);
    return () => {
      if (failSafeTimerRef.current) clearTimeout(failSafeTimerRef.current);
      if (initialOverlayTimerRef.current) clearTimeout(initialOverlayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!awaitingInitialFix) return;
    awaitingFixTimerRef.current = setTimeout(() => setAwaitingInitialFix(false), 2500);
    return () => {
      if (awaitingFixTimerRef.current) clearTimeout(awaitingFixTimerRef.current);
    };
  }, [awaitingInitialFix]);

  useEffect(() => {
    if (!awaitingInitialFix && map && !isRoutingActive && !hasFetchedOnMount.current) {
      if (skipMountEffectFetchRef.current) {
        skipMountEffectFetchRef.current = false;
        return;
      }
      const bounds = map.getBounds();
      if (bounds) {
        hasFetchedOnMount.current = true;
        fetchShops(bounds, { isInitialFetch: true });
      }
    }
  }, [awaitingInitialFix, map, isRoutingActive, fetchShops]);

  useEffect(() => {
    if (paramShopId && shops.length > 0 && lastSelectedShopId.current !== paramShopId) {
      const shop = shops.find(s => s.place_id === paramShopId);
      if (shop) {
        setSelectedShop(shop);
        lastSelectedShopId.current = paramShopId;
      }
    }
  }, [paramShopId, shops]);

  const activeTargetId = selectedShop
    ? selectedShop.place_id
    : unverifiedPlace
      ? unverifiedPlace.placeId
      : null;

  useEffect(() => {
    if (!map) return;

    if (!activeTargetId) {
      lastPannedTargetIdRef.current = null;
      return;
    }

    if (lastPannedTargetIdRef.current === activeTargetId) {
      return;
    }
    lastPannedTargetIdRef.current = activeTargetId;

    let target: google.maps.LatLngLiteral | null = null;

    if (
      selectedShop &&
      selectedShop.latitude !== null &&
      selectedShop.longitude !== null &&
      Number.isFinite(selectedShop.latitude) &&
      Number.isFinite(selectedShop.longitude)
    ) {
      target = { lat: selectedShop.latitude, lng: selectedShop.longitude };
    } else if (
      unverifiedPlace &&
      Number.isFinite(unverifiedPlace.latLng.lat) &&
      Number.isFinite(unverifiedPlace.latLng.lng)
    ) {
      target = unverifiedPlace.latLng;
    }

    if (target) {
      map.panTo(target);
    }

    return () => {
      if (cardPanTimeoutRef.current) {
        clearTimeout(cardPanTimeoutRef.current);
        cardPanTimeoutRef.current = null;
      }
    };
  }, [map, activeTargetId, selectedShop, unverifiedPlace]);

  useEffect(() => {
    const measureNavOffset = () => {
      const mapContainer = document.querySelector('[data-map-container]');
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        if (rect.top < 10) {
          const nav = document.querySelector('nav');
          const navH = nav ? nav.getBoundingClientRect().height : 80;
          setSearchTopOffset(navH - rect.top + 12);
        } else {
          setSearchTopOffset(16); 
        }
      }
    };

    measureNavOffset();
    window.addEventListener('resize', measureNavOffset);
    const raf = requestAnimationFrame(measureNavOffset);
    return () => {
      window.removeEventListener('resize', measureNavOffset);
      cancelAnimationFrame(raf);
    };
  }, []);

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    mapRef.current = mapInstance;
    setMap(mapInstance);
    const mapsApi = window.google?.maps as
      | (typeof google.maps & { importLibrary?: (lib: string) => Promise<unknown> })
      | undefined;
    if (typeof mapsApi?.importLibrary === "function") {
      void mapsApi.importLibrary("marker").catch(() => {
        // KebabAdvancedMarker retries/handles marker library loading if unavailable
      });
    }
    const pendingGpsCenter = pendingInitialGpsCenterRef.current;
    pendingInitialGpsCenterRef.current = null;
    if (pendingGpsCenter && !hasUserPanned.current && !hasValidParams) {
      isInitialCenterSet.current = true;
      mapInstance.setCenter(pendingGpsCenter);
    } else if (initialPosRef.current && !hasValidParams && !hasSavedSessionCenterRef.current) {
      const cur = mapInstance.getCenter();
      if (
        !cur ||
        Math.abs(cur.lat() - initialPosRef.current.lat) > 0.0005 ||
        Math.abs(cur.lng() - initialPosRef.current.lng) > 0.0005
      ) {
        mapInstance.setCenter(initialPosRef.current);
      }
    }
  }, [hasValidParams]);

  const onUnmount = useCallback(function callback() {
    mapRef.current = null;
    setMap(null);
  }, []);

  const handleDragStart = useCallback(() => {
    hasUserPanned.current = true;
    isInitialCenterSet.current = true;
  }, []);

  useEffect(() => {
    if (!map) return;
    const handleMapResize = () => {
      window.google?.maps?.event?.trigger(map, "resize");
    };
    window.addEventListener("resize", handleMapResize);
    return () => window.removeEventListener("resize", handleMapResize);
  }, [map]);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onIdle = useCallback(() => {
    const activeMap = mapRef.current ?? map;
    if (activeMap && !isRoutingActive) {
      if (awaitingInitialFixRef.current) {
        return;
      }

      const currentZoom = activeMap.getZoom();
      const currentCenter = activeMap.getCenter();
      
      if (currentZoom && currentCenter) {
        saveMapSession({ lat: currentCenter.lat(), lng: currentCenter.lng() }, currentZoom);
      }
      
      if (currentZoom !== undefined && currentZoom < MIN_MAP_ZOOM) {
        activeMap.setZoom(MIN_MAP_ZOOM);
        return;
      }
      const bounds = activeMap.getBounds();
      if (bounds) {
        if (pendingAreaFetchRef.current) {
          pendingAreaFetchRef.current = false;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          hasFetchedOnMount.current = true;
          void fetchShops(bounds, { isAreaFocus: true });
          return;
        }

        if (!hasFetchedOnMount.current) {
          hasFetchedOnMount.current = true;
          void fetchShops(bounds, { isInitialFetch: true });
        } else {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            const latestBounds = (mapRef.current ?? activeMap).getBounds();
            if (latestBounds) {
              void fetchShops(latestBounds);
            }
          }, 600);
        }
      }
    }
  }, [map, isRoutingActive, fetchShops, saveMapSession]);

  useEffect(() => {
    return () => {
      if (routingPolylineRef.current) {
        routingPolylineRef.current.setMap(null);
        routingPolylineRef.current = null;
      }
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (searchAbortRef.current) searchAbortRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (emptyRetryTimeoutRef.current) clearTimeout(emptyRetryTimeoutRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (areaLoadingWatchdogRef.current) clearTimeout(areaLoadingWatchdogRef.current);
      if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
      if (cardPanTimeoutRef.current) clearTimeout(cardPanTimeoutRef.current);
      if (failSafeTimerRef.current) clearTimeout(failSafeTimerRef.current);
      if (initialOverlayTimerRef.current) clearTimeout(initialOverlayTimerRef.current);
      if (awaitingFixTimerRef.current) clearTimeout(awaitingFixTimerRef.current);
    };
  }, []);

  const displayedShops = React.useMemo(() => {
    const personalExtras: KebabShop[] = [];
    if (userReviewsMap) {
      userReviewsMap.forEach((review) => {
        if (
          review.latitude !== null &&
          review.latitude !== undefined &&
          review.longitude !== null &&
          review.longitude !== undefined &&
          Number.isFinite(review.latitude) &&
          Number.isFinite(review.longitude)
        ) {
          personalExtras.push({
            place_id: review.place_id,
            name: review.shop_label ?? null,
            latitude: review.latitude,
            longitude: review.longitude,
            city: review.city ?? null,
            country: review.country ?? null,
            data_source: review.coords_expires_at ? "cache" : "fixture",
          });
        }
      });
    }
    if (userWishlistMap) {
      userWishlistMap.forEach((item) => {
        if (
          item.latitude !== null &&
          item.latitude !== undefined &&
          item.longitude !== null &&
          item.longitude !== undefined &&
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude)
        ) {
          personalExtras.push({
            place_id: item.place_id,
            name: item.shop_label ?? null,
            latitude: item.latitude,
            longitude: item.longitude,
            data_source: item.coords_expires_at ? "cache" : "fixture",
          });
        }
      });
    }
    return mergeShopsById(personalExtras, shops);
  }, [shops, userReviewsMap, userWishlistMap]);

  return (
    <div className="relative w-full h-full">
      <div ref={geocodeTurnstile.containerRef} />
      <div ref={shopsTurnstile.containerRef} />

      {sdkAuthError ? (
        <MapSdkFallbackCard
          message={sdkAuthError}
          onRetry={() => window.location.reload()}
          onUseLocalView={onFallbackToLocal}
        />
      ) : loadError ? (
        <MapSdkFallbackCard
          message={loadError.message}
          onRetry={() => window.location.reload()}
          onUseLocalView={onFallbackToLocal}
        />
      ) : !isLoaded ? (
        <MapLoadingScreen title="Caricamento Google Maps..." subtitle="Inizializzazione SDK" />
      ) : typeof window === "undefined" || typeof window.google?.maps?.Map !== "function" ? (
        <MapSdkFallbackCard
          message="Google Maps SDK caricato in modo incompleto (google.maps.Map non disponibile)."
          onRetry={() => window.location.reload()}
          onUseLocalView={onFallbackToLocal}
        />
      ) : (
    <div
      ref={containerRef}
      className={`relative w-full h-full font-quicksand ${
        !isMapFullyReady ? "pointer-events-none select-none" : ""
      }`}
      aria-hidden={!isMapFullyReady ? "true" : undefined}
      data-map-container
    >
      <style jsx global>{`
        .search-results-dropdown {
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {Number.isFinite(initialMapCenter.lat) && Number.isFinite(initialMapCenter.lng) ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={initialMapCenter}
          zoom={zoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onIdle={onIdle}
          onDragStart={handleDragStart}
          onClick={onMapClick}
          options={currentMapOptions}
        >
          {displayedShops.filter(s => s.latitude !== null && s.longitude !== null).map((shop) => {
            const existingReview = userReviewsMap?.get(shop.place_id);
            const inWishlist = isInWishlist(shop.place_id) || Boolean(userWishlistMap?.has(shop.place_id));
            const pinStatus: PersonalPinStatus = existingReview
              ? "visited"
              : inWishlist
                ? "wishlist"
                : "unvisited";
            const personalRating = existingReview
              ? existingReview.score_overall ?? calculateReviewAverage(existingReview)
              : null;
            const isSelected = selectedShop?.place_id === shop.place_id;
            const zIndex = isSelected ? 20 : pinStatus === "visited" ? 10 : pinStatus === "wishlist" ? 5 : 1;

            return (
              <KebabAdvancedMarker
                key={shop.place_id}
                position={{ lat: shop.latitude!, lng: shop.longitude! }}
                zIndex={zIndex}
                onClick={() => {
                   hasUserPanned.current = true;
                   isInitialCenterSet.current = true;
                   if (isRoutingActive) {
                     startRouting(shop);
                   } else {
                     setUnverifiedPlace(null);
                     setSelectedShop(shop);
                   }
                }}
              >
                <DynamicShopPin
                  status={pinStatus}
                  personalRating={personalRating}
                  inWishlist={inWishlist}
                  isSelected={isSelected}
                />
              </KebabAdvancedMarker>
            );
          })}

          {userLocation && (
            <KebabAdvancedMarker
              position={userLocation}
              zIndex={100}
              anchor="center"
              clickable={false}
            >
              {/* Cono direzionale stile Google Maps — ruota col compass */}
              <div 
                ref={compassRef}
                className="absolute w-20 h-20 -top-10 -left-10 pointer-events-none z-10 flex items-center justify-center"
                style={{ 
                  transformOrigin: '40px 40px',
                  opacity: 0,
                  transition: 'opacity 0.4s ease-out'
                }}
              >
                <svg
                  viewBox="0 0 80 80"
                  className="w-20 h-20 pointer-events-none"
                  aria-hidden="true"
                >
                  <defs>
                    <radialGradient id="userHeadingBeam" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor="hsl(var(--gps-dot))" stopOpacity="0.8" />
                      <stop offset="30%" stopColor="hsl(var(--gps-dot))" stopOpacity="0.5" />
                      <stop offset="65%" stopColor="hsl(var(--gps-ring))" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="hsl(var(--gps-beam))" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <path
                    d="M 40,40 L 20,5.36 A 40,40 0 0,1 60,5.36 Z"
                    fill="url(#userHeadingBeam)"
                  />
                </svg>
              </div>
              
              {/* Pallino Blu Utente centrato su (0, 0) */}
              <div className="absolute size-4 -top-2 -left-2 bg-gps-dot rounded-full border-2 border-card shadow-flat z-20" />
              <div className="absolute size-4 -top-2 -left-2 bg-gps-ring rounded-full animate-ping opacity-40 z-0" />
            </KebabAdvancedMarker>
          )}

        </GoogleMap>
      ) : (
        <div className="flex items-center justify-center w-full h-full bg-background text-muted-foreground font-bold">
          Configurazione mappa non valida...
        </div>
      )}

      {selectedShop && (
        <ShopInfoCard
          shop={selectedShop}
          userLocation={userLocation}
          existingReview={userReviewsMap?.get(selectedShop.place_id) || null}
          existingWishlist={userWishlistMap?.get(selectedShop.place_id) || null}
          isWishlisted={isInWishlist(selectedShop.place_id)}
          onToggleWishlist={handleToggleWishlist}
          onSaveReview={handleSaveDiaryReview}
          onDeleteReview={handleDeleteDiaryReview}
          onStartRouting={startRouting}
          onClose={() => setSelectedShop(null)}
        />
      )}

      {unverifiedPlace && (
        <UnverifiedShopCard
          unverifiedPlace={unverifiedPlace}
          onClose={() => setUnverifiedPlace(null)}
        />
      )}

      {loadingShops && !isRoutingActive && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 bg-card/95 backdrop-blur-md px-4 py-1.5 rounded-full shadow-dropdown border border-border text-xs font-bold text-foreground z-10 animate-pulse"
          style={{ top: searchTopOffset + 56 }}
        >
          Ricerca kebab in zona...
        </div>
      )}

      {!isRoutingActive && mounted && (
        <MapSearchBar
          searchQuery={searchQuery}
          isSearching={isSearching}
          searchError={searchError}
          topOffset={searchTopOffset}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onClear={() => {
            setSearchQuery("");
            setSearchError(null);
          }}
        />
      )}

      {isRoutingActive && routingDestination && (
        <RoutingPanel
          destination={routingDestination}
          routingInfo={routingInfo}
          travelMode={travelMode}
          onTravelModeChange={(mode) => {
            setTravelMode(mode);
            calculateRouteInfo(routingDestination, mode);
          }}
          onCancel={cancelRouting}
        />
      )}

      {locationError && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 bg-card/95 backdrop-blur-md border border-border text-foreground px-4 py-3 rounded-2xl shadow-dropdown flex items-center gap-3 z-30 w-11/12 max-w-md animate-in fade-in slide-in-from-top-4 duration-300 font-quicksand"
          style={{ top: searchTopOffset + 60 }}
        >
          <div className="flex-1 text-xs font-black uppercase tracking-tight leading-relaxed">
            {locationError}
          </div>
          <button 
            type="button"
            onClick={() => {
              setLocationError(null);
              startTracking({ forcePrompt: true });
            }}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-[0.1em] hover:bg-primary/90 flat-press shadow-flat shrink-0"
          >
            Riprova
          </button>
          <button
            type="button"
            onClick={() => setLocationError(null)}
            aria-label="Chiudi avviso posizione"
            className="size-7 rounded-full bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 flat-press"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {!isRoutingActive && (
        <>
          <div className="absolute bottom-[calc(var(--dock-h)+var(--dock-gap)+var(--safe-b)+1rem)] sm:bottom-6 left-4 z-20 flex items-center gap-2">
            <SectionInfoButton
              title="Guida alla Mappa"
              subtitle="Legenda e funzionalità"
              buttonSize="md"
              ariaLabel="Informazioni e legenda della mappa"
              items={[
                {
                  label: "Colori dei Pin",
                  description: "I pin con voto indicano i locali nel tuo Diario personale, i pin con segnalibro sono salvati in Wishlist e i pin kebab standard rappresentano le scoperte su Google Maps.",
                },
                {
                  label: "Ricerca On-Submit & Zoom",
                  description: "La ricerca si aggiorna premendo Invio o esplorando l'area a zoom ravvicinato (≥ 13) per evitare chiamate di rete superflue.",
                },
                {
                  label: "Locali Google & Azioni",
                  description: "Tocca un locale per visualizzare la scheda dettagli, salvarlo in Wishlist con 1 tap o registrare una nuova recensione nel tuo Diario.",
                },
                {
                  label: "Privacy & Revoca Consensi",
                  description: "Puoi revocare in qualsiasi momento il consenso a Google Maps o al GPS dal pulsante Scudo qui accanto (Preferenze Profilo) e consultare Privacy e Cookie Policy.",
                },
              ]}
            />
            <Link
              href="/profile/preferences"
              aria-label="Gestisci consensi mappa, GPS e privacy"
              title="Consensi & Privacy"
              className="size-10 rounded-full bg-card/95 backdrop-blur-md border border-border shadow-dropdown text-muted-foreground hover:text-primary flex items-center justify-center transition-colors flat-press"
            >
              <ShieldCheck className="size-4" />
            </Link>
          </div>
          <button
            type="button"
            onClick={handleLocateClick}
            className="absolute bottom-[calc(var(--dock-h)+var(--dock-gap)+var(--safe-b)+1rem)] sm:bottom-6 right-4 size-14 bg-card/95 backdrop-blur-md rounded-full shadow-dropdown border border-border text-primary flat-press z-20 flex items-center justify-center group"
            title="Localizzami e attiva bussola"
            aria-label="Localizzami e attiva bussola"
          >
            <LocateFixed className="size-6" />
          </button>
        </>
      )}

      {showDisambiguationModal && searchResults.length > 0 && (
        <div 
          className="fixed inset-0 z-[100] overflow-y-auto app-scroll overscroll-contain flex flex-col p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disambiguation-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowDisambiguationModal(false);
              setSearchResults([]);
            }
          }}
        >
          <div className="my-auto mx-auto w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-dropdown animate-in zoom-in-95 duration-200 text-card-foreground">
            <div className="flex justify-between items-start mb-4">
              <h3 id="disambiguation-title" className="text-xl font-black text-foreground uppercase tracking-tight">
                Più luoghi trovati
              </h3>
              <button 
                onClick={() => { setShowDisambiguationModal(false); setSearchResults([]); }}
                className="size-8 flex items-center justify-center hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors flat-press"
                aria-label="Chiudi ricerca"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6 font-medium">Abbiamo trovato diversi risultati per la tua ricerca. Seleziona quello corretto:</p>
            <div className="space-y-3 max-h-[60vh] app-scroll pr-2">
              {searchResults.map((res, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectResult(res)}
                  className="w-full text-left p-4 rounded-2xl bg-muted/50 hover:bg-primary/10 border border-border hover:border-primary/50 transition-all flat-press group"
                >
                  <p className="text-sm text-foreground font-bold group-hover:text-primary transition-colors line-clamp-2">
                    {res.display_name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAreaLoading && <MapAreaLoadingModal />}

      {showOverlay && (
        <MapLoadingScreen
          isOverlay
          isInitialLoading={isInitialLoading}
          stepLabel={
            awaitingInitialFix
              ? "Rilevamento posizione GPS"
              : !initialViewportReady
                ? "Caricamento locali in zona"
                : undefined
          }
        />
      )}
    </div>
      )}

      {showGeoPrompt && (
        <GeoPermissionPrompt
          onAccept={handleGeoAccept}
          onDecline={handleGeoDecline}
        />
      )}
    </div>
  );
}
