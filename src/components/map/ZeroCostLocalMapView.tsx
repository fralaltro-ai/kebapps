"use client";

import React, { useMemo, useState } from "react";
import { Bookmark, Car, Check, ExternalLink, Footprints, MapPin, Search, ShieldCheck, Star } from "lucide-react";
import {
  calculateHaversineDistance,
  estimateTravelTime,
  formatDistance,
  formatShopName,
  formatShopStreetAddress,
  formatTime,
  getGoogleMapsDeepLink,
} from "@/lib/geoUtils";
import { LOCAL_DEV_SHOP_FIXTURES } from "@/lib/map-proxy-config";
import { calculateReviewAverage, ratingToExperienceLevel } from "@/lib/ratingLabels";
import { SectionInfoButton } from "../ui/SectionInfoButton";
import DiaryEntryModal, { type DiaryModalInitialData } from "../diary/DiaryEntryModal";
import type { KebabShop } from "@/hooks/useShopCache";
import type { UserReview } from "@/hooks/useUserReviews";

interface ZeroCostLocalMapViewProps {
  userReviewsMap: Map<string, UserReview>;
  isInWishlist: (placeId: string) => boolean;
  onToggleWishlist: (shop: KebabShop) => Promise<void> | void;
  userLocation: { lat: number; lng: number } | null;
}

const FIXTURE_SHOPS: KebabShop[] = LOCAL_DEV_SHOP_FIXTURES.map((s) => ({
  place_id: s.place_id,
  name: s.name,
  latitude: s.latitude,
  longitude: s.longitude,
  address: s.address,
  city: s.city,
  region: s.region,
  country: s.country,
  data_source: s.data_source,
}));

export default function ZeroCostLocalMapView({
  userReviewsMap,
  isInWishlist,
  onToggleWishlist,
  userLocation,
}: ZeroCostLocalMapViewProps) {
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [modalShop, setModalShop] = useState<KebabShop | null>(null);

  const filteredShops = useMemo(() => {
    const q = activeQuery.trim().toLowerCase();
    if (!q) return FIXTURE_SHOPS;
    return FIXTURE_SHOPS.filter(
      (shop) =>
        (shop.name?.toLowerCase().includes(q) ?? false) ||
        (shop.city?.toLowerCase().includes(q) ?? false) ||
        (shop.address?.toLowerCase().includes(q) ?? false)
    );
  }, [activeQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(queryInput);
  };

  return (
    <div
      data-testid="zero-cost-map-view"
      data-map-container
      className="w-full h-full overflow-y-auto app-scroll bg-background px-4 pt-4 pb-28 font-quicksand"
    >
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="bg-card p-5 rounded-3xl border border-border shadow-flat space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider">
              <ShieldCheck className="size-3.5" />
              Modalità Casa / Zero-Cost Attiva
            </div>
            <SectionInfoButton
              title="Modalità Zero-Cost"
              subtitle="Nessuna API a Pagamento"
              buttonSize="sm"
              ariaLabel="Info modalità zero-cost"
              items={[
                {
                  label: "Fixture Dimostrative",
                  description: "Stai visualizzando dati statici locali dimostrativi inclusi nell'applicazione, con zero chiamate a Google Maps API o server remoti.",
                },
                {
                  label: "Funzioni & Dati 100% Locali",
                  description: "Diario, Wishlist, note personali, calcoli geodetici Haversine ed export/import di backup operano interamente sul tuo dispositivo.",
                },
              ]}
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Esplorazione Locale (Senza API a Pagamento)
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
              Nessuna chiave Google Maps configurata: stai esplorando esempi statici dimostrativi (non esercizi reali) a costo 0,00&nbsp;&euro;.
              Diario personale, Wishlist, stime Haversine offline e Backup JSON funzionano integralmente.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="size-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => {
                  setQueryInput(e.target.value);
                  if (!e.target.value.trim()) setActiveQuery("");
                }}
                aria-label="Cerca nelle fixture locali"
                placeholder="Filtra per nome o città (es. Milano, Roma)..."
                className="w-full rounded-2xl bg-muted/50 border border-border pl-10 pr-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider shadow-flat flat-press"
            >
              Cerca
            </button>
          </form>
        </div>

        {filteredShops.length === 0 ? (
          <div className="bg-card p-6 rounded-3xl border border-border shadow-flat text-center space-y-2">
            <p className="text-sm font-bold text-foreground">Nessun locale trovato per &ldquo;{activeQuery}&rdquo;.</p>
            <button
              type="button"
              onClick={() => {
                setQueryInput("");
                setActiveQuery("");
              }}
              className="px-4 py-2 rounded-xl bg-muted border border-border text-xs font-black uppercase tracking-wider flat-press"
            >
              Mostra tutti
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredShops.map((shop) => {
              const review = userReviewsMap.get(shop.place_id) || null;
              const wishlisted = isInWishlist(shop.place_id);
              const score = review ? review.score_overall ?? calculateReviewAverage(review) : null;
              const level = score !== null ? ratingToExperienceLevel(score) : null;
              const distKm =
                userLocation && shop.latitude !== null && shop.longitude !== null
                  ? calculateHaversineDistance(userLocation, { lat: shop.latitude, lng: shop.longitude })
                  : null;
              const walkMin = distKm !== null ? estimateTravelTime(distKm, "walking") : null;
              const driveMin = distKm !== null ? estimateTravelTime(distKm, "driving") : null;

              return (
                <article
                  key={shop.place_id}
                  className="bg-card p-5 rounded-3xl border border-border shadow-flat flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      {review && score !== null && level ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <Check className="size-3" /> Visitato · {score.toFixed(1)}/5 ({level.short})
                        </span>
                      ) : wishlisted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Bookmark className="size-3 fill-current" /> In Wishlist
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                          Esempio Dimostrativo (Non Reale)
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-black text-foreground leading-tight">
                      {formatShopName(shop)}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium">
                      {shop.address || formatShopStreetAddress(shop)}
                    </p>

                    {distKm !== null && (
                      <div className="p-2.5 rounded-2xl bg-muted/50 border border-border flex items-center justify-between gap-2 text-[11px] font-bold">
                        <span className="inline-flex items-center gap-1 text-primary font-black">
                          <MapPin className="size-3.5" /> {formatDistance(distKm)}
                        </span>
                        <div className="flex items-center gap-2.5 text-muted-foreground">
                          {walkMin !== null && (
                            <span className="inline-flex items-center gap-1">
                              <Footprints className="size-3.5" /> {formatTime(walkMin)}
                            </span>
                          )}
                          {driveMin !== null && (
                            <span className="inline-flex items-center gap-1">
                              <Car className="size-3.5" /> {formatTime(driveMin)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setModalShop(shop)}
                        className="py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider shadow-flat flat-press inline-flex items-center justify-center gap-1.5"
                      >
                        <Star className="size-3.5" />
                        {review ? "Modifica" : "Valuta"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleWishlist(shop)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase tracking-wider flat-press inline-flex items-center justify-center gap-1.5 ${
                          wishlisted
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300"
                            : "bg-card hover:bg-muted border-border text-foreground"
                        }`}
                      >
                        <Bookmark className={`size-3.5 ${wishlisted ? "fill-current" : ""}`} />
                        {wishlisted ? "Salvato" : "Wishlist"}
                      </button>
                    </div>

                    {shop.latitude !== null && shop.longitude !== null && (
                      <a
                        href={getGoogleMapsDeepLink(shop.latitude, shop.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-xl bg-muted/60 hover:bg-muted border border-border text-[11px] uppercase tracking-wider font-black text-primary flex items-center justify-center gap-1.5 flat-press"
                      >
                        Apri in Google Maps <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {modalShop && (
        <DiaryEntryModal
          isOpen={true}
          onClose={() => setModalShop(null)}
          initialData={
            (() => {
              const existing = userReviewsMap.get(modalShop.place_id);
              const base: DiaryModalInitialData = {
                place_id: modalShop.place_id,
                shop_label: formatShopName(modalShop),
                city: modalShop.city ?? null,
                country: modalShop.country ?? null,
                latitude: modalShop.latitude,
                longitude: modalShop.longitude,
              };
              return existing ? { ...base, ...existing } : base;
            })()
          }
          onSaved={() => {
            setModalShop(null);
          }}
        />
      )}
    </div>
  );
}
