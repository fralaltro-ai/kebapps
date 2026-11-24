"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  calculateHaversineDistance,
  estimateTravelTime,
  formatDistance,
  formatShopStreetAddress,
  formatTime,
  getGoogleMapsPlaceLink,
} from "@/lib/geoUtils";
import {
  Bookmark,
  Car,
  Check,
  ExternalLink,
  Footprints,
  MapPin,
  Navigation,
  Star,
  Trash2,
  X as CloseIcon,
} from "lucide-react";
import { GoogleAttribution } from "../ui/GoogleAttribution";
import GooglePlaceDetailsWidget from "./GooglePlaceDetailsWidget";
import {
  CATEGORY_META,
  calculateReviewAverage,
  ratingToExperienceLevel,
} from "@/lib/ratingLabels";
import type { KebabShop } from "@/hooks/useShopCache";
import type { UserReview } from "@/hooks/useUserReviews";
import {
  GOOGLE_COORDS_TTL_MS,
  MAX_SHOP_LABEL_LENGTH,
  type DiaryEntryInput,
  type WishlistEntry,
} from "@/lib/local-storage/schema";

interface ShopInfoCardProps {
  shop: KebabShop;
  userLocation: google.maps.LatLngLiteral | null;
  existingReview?: UserReview | null;
  existingWishlist?: WishlistEntry | null;
  isWishlisted?: boolean;
  onToggleWishlist?: (shop: KebabShop, customLabel?: string) => Promise<void> | void;
  onSaveReview?: (shop: KebabShop, input: DiaryEntryInput) => Promise<void> | void;
  onDeleteReview?: (placeId: string) => Promise<void> | void;
  onStartRouting: (shop: KebabShop) => void;
  onClose: () => void;
}

type ScoreKey = "score_meat" | "score_bread" | "score_sauces" | "score_value";

const QUICK_SCORE_DIMENSIONS: Array<{
  key: ScoreKey;
  label: string;
}> = [
  { key: "score_meat", label: CATEGORY_META.meat.short },
  { key: "score_bread", label: CATEGORY_META.bread.short },
  { key: "score_sauces", label: CATEGORY_META.sauces.short },
  { key: "score_value", label: CATEGORY_META.value.short },
];

export default function ShopInfoCard({
  shop,
  userLocation,
  existingReview = null,
  existingWishlist = null,
  isWishlisted = false,
  onToggleWishlist,
  onSaveReview,
  onDeleteReview,
  onStartRouting,
  onClose,
}: ShopInfoCardProps) {
  const [mounted, setMounted] = useState(false);
  const [isEditingDiary, setIsEditingDiary] = useState(false);
  const [isEditingWishlistLabel, setIsEditingWishlistLabel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const userResolvedLabel =
    existingReview?.shop_label?.trim() ||
    existingWishlist?.shop_label?.trim() ||
    shop.name?.trim() ||
    "";
  const isGoogleManagedShop = shop.data_source === "google" || shop.data_source === "cache";

  const [shopLabelInput, setShopLabelInput] = useState(userResolvedLabel);
  const [wishlistLabelInput, setWishlistLabelInput] = useState(userResolvedLabel);
  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    score_meat: existingReview?.score_meat ?? 4,
    score_bread: existingReview?.score_bread ?? 4,
    score_sauces: existingReview?.score_sauces ?? 4,
    score_value: existingReview?.score_value ?? 4,
  });
  const [scoreLocation, setScoreLocation] = useState<number | null>(
    existingReview?.score_location ?? null
  );
  const [note, setNote] = useState(existingReview?.note ?? "");

  useEffect(() => {
    const resolved =
      existingReview?.shop_label?.trim() ||
      existingWishlist?.shop_label?.trim() ||
      shop.name?.trim() ||
      "";
    setShopLabelInput(resolved);
    setWishlistLabelInput(resolved);
    setScores({
      score_meat: existingReview?.score_meat ?? 4,
      score_bread: existingReview?.score_bread ?? 4,
      score_sauces: existingReview?.score_sauces ?? 4,
      score_value: existingReview?.score_value ?? 4,
    });
    setScoreLocation(existingReview?.score_location ?? null);
    setNote(existingReview?.note ?? "");
    setIsEditingDiary(false);
    setIsEditingWishlistLabel(false);
  }, [shop.place_id, shop.name, existingReview, existingWishlist]);

  const distanceKm =
    userLocation && shop.latitude !== null && shop.longitude !== null
      ? calculateHaversineDistance(userLocation, { lat: shop.latitude, lng: shop.longitude })
      : null;

  const walkingMinutes =
    distanceKm !== null && Number.isFinite(distanceKm)
      ? estimateTravelTime(distanceKm, "walking")
      : null;
  const drivingMinutes =
    distanceKm !== null && Number.isFinite(distanceKm)
      ? estimateTravelTime(distanceKm, "driving")
      : null;

  if (!mounted || shop.latitude === null || shop.longitude === null) return null;

  const personalScore = existingReview
    ? existingReview.score_overall ?? calculateReviewAverage(existingReview)
    : null;
  const personalLevel = personalScore !== null ? ratingToExperienceLevel(personalScore) : null;

  const handleDiarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cleanedLabel = shopLabelInput.trim().slice(0, MAX_SHOP_LABEL_LENGTH);
    if (!onSaveReview || isSubmitting || !cleanedLabel) return;

    const coordsExpiresAt =
      isGoogleManagedShop && shop.latitude !== null && shop.longitude !== null
        ? Date.now() + GOOGLE_COORDS_TTL_MS
        : null;

    setIsSubmitting(true);
    try {
      await onSaveReview(shop, {
        place_id: shop.place_id,
        shop_label: cleanedLabel,
        city: shop.city ?? existingReview?.city ?? null,
        country: shop.country ?? existingReview?.country ?? null,
        latitude: shop.latitude,
        longitude: shop.longitude,
        coords_expires_at: coordsExpiresAt,
        score_meat: scores.score_meat,
        score_bread: scores.score_bread,
        score_sauces: scores.score_sauces,
        score_value: scores.score_value,
        score_location: scoreLocation,
        note: note.trim(),
      });
      setIsEditingDiary(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWishlistAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleWishlist) return;
    if (isWishlisted) {
      await onToggleWishlist(shop);
      setIsEditingWishlistLabel(false);
      return;
    }
    if (userResolvedLabel) {
      await onToggleWishlist(shop, userResolvedLabel);
      return;
    }
    setIsEditingWishlistLabel(true);
  };

  const handleWishlistLabelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cleaned = wishlistLabelInput.trim().slice(0, MAX_SHOP_LABEL_LENGTH);
    if (!onToggleWishlist || !cleaned) return;
    await onToggleWishlist(shop, cleaned);
    setIsEditingWishlistLabel(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-background/55 backdrop-blur-[2px] animate-in fade-in duration-150 font-quicksand"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-info-card-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] drop-shadow-lg cursor-auto pointer-events-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 w-full bg-card rounded-3xl border border-border shadow-dropdown font-quicksand relative text-card-foreground max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain app-scroll">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 size-7 bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full flex items-center justify-center transition-colors flat-press z-30"
            aria-label="Chiudi dettagli negozio"
          >
            <CloseIcon className="size-4" />
          </button>

          {/* Header locale */}
          <div className="flex flex-col gap-1 mb-3">
            <div className="flex items-center gap-1.5 pr-8 flex-wrap">
              {existingReview ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <Check className="size-3" /> Visitato
                </span>
              ) : isWishlisted ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Bookmark className="size-3 fill-current" /> In Wishlist
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                  Da scoprire
                </span>
              )}
            </div>

            {userResolvedLabel ? (
              <>
                <h3 id="shop-info-card-title" className="font-black text-lg leading-tight text-foreground tracking-tight line-clamp-2 whitespace-normal break-words pr-6">
                  {userResolvedLabel}
                </h3>
                {(shop.address || shop.city) && !isGoogleManagedShop && (
                  <p className="text-xs text-muted-foreground font-medium line-clamp-1 whitespace-normal break-words">
                    {shop.address || formatShopStreetAddress(shop)}
                  </p>
                )}
              </>
            ) : (
              <h3 id="shop-info-card-title" className="sr-only">
                Dettagli locale su Google Maps
              </h3>
            )}

            {isGoogleManagedShop && (
              <div className="pt-1">
                <GooglePlaceDetailsWidget
                  placeId={shop.place_id}
                  latitude={shop.latitude}
                  longitude={shop.longitude}
                />
              </div>
            )}
          </div>

          {/* Stima distanza & tempi 100% offline (Haversine) */}
          {distanceKm !== null && Number.isFinite(distanceKm) && (
            <div className="mb-3 p-2.5 rounded-2xl bg-muted/60 border border-border flex items-center justify-between gap-2 text-[11px] font-bold text-foreground">
              <span className="inline-flex items-center gap-1 text-primary font-black shrink-0">
                <MapPin className="size-3.5" />
                {formatDistance(distanceKm)}
              </span>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                {walkingMinutes !== null && (
                  <span className="inline-flex items-center gap-1" title="Stima offline a piedi">
                    <Footprints className="size-3.5 text-foreground/70" />
                    {formatTime(walkingMinutes)}
                  </span>
                )}
                {drivingMinutes !== null && (
                  <span className="inline-flex items-center gap-1" title="Stima offline in auto">
                    <Car className="size-3.5 text-foreground/70" />
                    {formatTime(drivingMinutes)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Riepilogo voto personale nel Diario */}
          {existingReview && personalScore !== null && personalLevel && !isEditingDiary && (
            <div className="mb-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-flat">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 tracking-wider block">
                  Il tuo voto nel Diario
                </span>
                <span className="text-sm font-extrabold text-foreground tracking-tight block truncate">
                  {personalLevel.short} ({personalScore.toFixed(1)}/5)
                </span>
                {existingReview.note && (
                  <p className="text-[11px] text-muted-foreground font-medium line-clamp-2 mt-0.5">
                    &ldquo;{existingReview.note}&rdquo;
                  </p>
                )}
              </div>
              {onDeleteReview && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDeleteReview(shop.place_id);
                  }}
                  className="size-8 rounded-xl bg-card/80 hover:bg-destructive/15 border border-border hover:border-destructive/30 text-muted-foreground hover:text-destructive flex items-center justify-center shrink-0 transition-colors flat-press"
                  aria-label="Rimuovi dal diario"
                  title="Rimuovi dal diario"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Editor inline immediato Diario (nessun check-in GPS / attesa) */}
          {isEditingDiary ? (
            <form onSubmit={(e) => void handleDiarySubmit(e)} className="mb-3 p-3 rounded-2xl bg-muted/50 border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
                  {existingReview ? "Aggiorna Diario" : "Segna Visitato & Vota"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingDiary(false);
                  }}
                  className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
                >
                  Annulla
                </button>
              </div>

              <div>
                <label
                  htmlFor="quick-diary-shop-label"
                  className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1"
                >
                  Nome locale nel tuo Diario *
                </label>
                <input
                  id="quick-diary-shop-label"
                  type="text"
                  required
                  maxLength={MAX_SHOP_LABEL_LENGTH}
                  value={shopLabelInput}
                  onChange={(e) => setShopLabelInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Inserisci il nome del locale..."
                  className="w-full rounded-xl bg-card border border-border px-2.5 py-1.5 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {QUICK_SCORE_DIMENSIONS.map((dim) => (
                <div key={dim.key} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">{dim.label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScores((prev) => ({ ...prev, [dim.key]: val }));
                        }}
                        className={`size-6 rounded-lg text-[11px] font-black transition-all flat-press border ${
                          scores[dim.key] === val
                            ? "bg-primary text-primary-foreground border-primary shadow-flat"
                            : "bg-card text-muted-foreground border-border hover:border-primary/40"
                        }`}
                        aria-label={`${dim.label} ${val}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground">Location</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScoreLocation(null);
                    }}
                    className={`px-1.5 h-6 rounded-lg text-[10px] font-black border flat-press ${
                      scoreLocation === null
                        ? "bg-primary/15 text-primary border-primary/40"
                        : "bg-card text-muted-foreground border-border"
                    }`}
                  >
                    N/A
                  </button>
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScoreLocation(val);
                      }}
                      className={`size-6 rounded-lg text-[11px] font-black transition-all flat-press border ${
                        scoreLocation === val
                          ? "bg-primary text-primary-foreground border-primary shadow-flat"
                          : "bg-card text-muted-foreground border-border hover:border-primary/40"
                      }`}
                      aria-label={`Location ${val}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Nota personale (opzionale)..."
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-xl bg-card border border-border px-2.5 py-1.5 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider bg-primary text-primary-foreground shadow-flat flat-press flex items-center justify-center gap-1.5"
              >
                <Check className="size-3.5" />
                {isSubmitting ? "Salvataggio..." : "Salva nel Diario"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingDiary(true);
              }}
              className="w-full py-3 px-3 rounded-2xl text-xs font-black uppercase tracking-wide transition-all mb-2.5 flex items-center justify-center gap-2 flat-press leading-tight text-center bg-primary text-primary-foreground shadow-flat"
            >
              <Star className="size-4 shrink-0" />
              {existingReview ? "Modifica nel Diario" : "Segna Visitato / Recensisci"}
            </button>
          )}

          {/* Azioni secondarie: Wishlist immediata + Percorso offline */}
          {isEditingWishlistLabel && !isWishlisted && (
            <form
              onSubmit={(e) => void handleWishlistLabelSubmit(e)}
              onClick={(e) => e.stopPropagation()}
              className="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2"
            >
              <label
                htmlFor="quick-wishlist-label"
                className="text-[10px] font-black uppercase tracking-wider text-foreground block"
              >
                Nome per la tua Wishlist *
              </label>
              <input
                id="quick-wishlist-label"
                type="text"
                required
                maxLength={MAX_SHOP_LABEL_LENGTH}
                value={wishlistLabelInput}
                onChange={(e) => setWishlistLabelInput(e.target.value)}
                placeholder="Es. Sultan Kebap..."
                className="w-full rounded-xl bg-card border border-border px-2.5 py-1.5 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider flat-press"
                >
                  Salva in Wishlist
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingWishlistLabel(false)}
                  className="py-2 px-3 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground"
                >
                  Annulla
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={(e) => void handleWishlistAction(e)}
              className={`border py-2.5 px-2 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all flat-press flex items-center justify-center gap-1.5 leading-tight ${
                isWishlisted
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300"
                  : "bg-card hover:bg-muted border-border text-foreground shadow-sm"
              }`}
            >
              <Bookmark className={`size-3.5 shrink-0 ${isWishlisted ? "fill-current" : ""}`} />
              {isWishlisted ? "In Wishlist" : "Wishlist"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartRouting(shop);
              }}
              className="bg-card hover:bg-muted border border-border text-foreground shadow-sm py-2.5 px-2 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all flat-press flex items-center justify-center gap-1.5 leading-tight"
            >
              <Navigation className="size-3.5 shrink-0" /> Percorso
            </button>
          </div>

          {/* Pulsante diretto Google Maps */}
          <a
            href={getGoogleMapsPlaceLink(userResolvedLabel || "Kebab", shop.place_id, shop.latitude, shop.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-full py-2 px-3 rounded-2xl bg-muted/60 hover:bg-muted border border-border text-[11px] uppercase tracking-wider font-black text-primary flex items-center justify-center gap-1.5 transition-colors flat-press"
          >
            Apri in Google Maps <ExternalLink className="size-3.5 shrink-0" />
          </a>

          <GoogleAttribution className="mt-2.5 text-center" />
        </div>
      </div>
    </div>,
    document.body
  );
}
