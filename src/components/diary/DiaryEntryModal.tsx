"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BadgePercent,
  Calendar,
  Check,
  Droplets,
  Flame,
  Layers,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import {
  deleteWishlistEntry,
  upsertDiaryEntry,
} from "@/lib/local-storage/db";
import {
  MAX_DIARY_NOTE_LENGTH,
  MAX_GEO_LABEL_LENGTH,
  MAX_SHOP_LABEL_LENGTH,
  type DiaryEntry,
} from "@/lib/local-storage/schema";
import {
  CATEGORY_META,
  COMPONENT_DESCRIPTORS,
  calculateReviewAverage,
  getLevelByValue,
} from "@/lib/ratingLabels";
import { triggerHaptic } from "@/lib/haptics";

export interface DiaryModalInitialData {
  place_id?: string;
  shop_label?: string;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coords_expires_at?: number | null;
  score_overall?: number;
  score_meat?: number;
  score_bread?: number;
  score_sauces?: number;
  score_value?: number;
  score_location?: number | null;
  note?: string;
  visited_at?: string;
}

interface DiaryEntryModalProps {
  isOpen: boolean;
  initialData?: DiaryModalInitialData | null;
  convertFromWishlist?: boolean;
  onClose: () => void;
  onSaved?: (entry: DiaryEntry) => void;
}

type CoreDimensionKey = "meat" | "bread" | "sauces" | "value";
type ScoreFieldKey = "score_meat" | "score_bread" | "score_sauces" | "score_value";

const CORE_DIMENSIONS: Array<{
  dim: CoreDimensionKey;
  field: ScoreFieldKey;
  icon: React.ElementType;
}> = [
  { dim: "meat", field: "score_meat", icon: Flame },
  { dim: "bread", field: "score_bread", icon: Layers },
  { dim: "sauces", field: "score_sauces", icon: Droplets },
  { dim: "value", field: "score_value", icon: BadgePercent },
];

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(isoOrDate: string | undefined): string {
  if (!isoOrDate) return todayDateInput();
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  const parsed = Date.parse(isoOrDate);
  if (Number.isNaN(parsed)) return todayDateInput();
  return new Date(parsed).toISOString().slice(0, 10);
}

function generateLocalPlaceId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `local_shop_${Date.now()}_${rand}`;
}

export function notifyLocalDataChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kebapps:local-data-changed"));
  }
}

export default function DiaryEntryModal({
  isOpen,
  initialData = null,
  convertFromWishlist = false,
  onClose,
  onSaved,
}: DiaryEntryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [shopLabel, setShopLabel] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [visitedDate, setVisitedDate] = useState(todayDateInput);
  const [scores, setScores] = useState<Record<ScoreFieldKey, number>>({
    score_meat: 4,
    score_bread: 4,
    score_sauces: 4,
    score_value: 4,
  });
  const [scoreLocation, setScoreLocation] = useState<number | null>(4);
  const [autoOverall, setAutoOverall] = useState(true);
  const [manualOverall, setManualOverall] = useState(4);
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setShopLabel(initialData?.shop_label ?? "");
    setCity(initialData?.city ?? "");
    setCountry(initialData?.country ?? "");
    setVisitedDate(toDateInputValue(initialData?.visited_at));

    const meat = initialData?.score_meat ?? 4;
    const bread = initialData?.score_bread ?? 4;
    const sauces = initialData?.score_sauces ?? 4;
    const value = initialData?.score_value ?? 4;
    const location = initialData?.score_location !== undefined ? initialData.score_location : 4;

    setScores({
      score_meat: meat,
      score_bread: bread,
      score_sauces: sauces,
      score_value: value,
    });
    setScoreLocation(location);

    const computed = Number(
      calculateReviewAverage({
        score_meat: meat,
        score_bread: bread,
        score_sauces: sauces,
        score_value: value,
        score_location: location,
      }).toFixed(2)
    );

    if (
      typeof initialData?.score_overall === "number" &&
      Math.abs(initialData.score_overall - computed) > 0.05
    ) {
      setAutoOverall(false);
      setManualOverall(Math.min(5, Math.max(1, Math.round(initialData.score_overall))));
    } else {
      setAutoOverall(true);
      setManualOverall(Math.round(computed));
    }

    setNote(initialData?.note ?? "");
    setErrorMsg(null);
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const computedAverage = Number(
    calculateReviewAverage({
      ...scores,
      score_location: scoreLocation,
    }).toFixed(2)
  );
  const effectiveOverall = autoOverall ? computedAverage : manualOverall;
  const overallLevel = getLevelByValue(effectiveOverall);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = shopLabel.trim();
    if (!trimmedLabel) {
      setErrorMsg("Inserisci il nome del locale.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const targetPlaceId = initialData?.place_id?.trim() || generateLocalPlaceId();
      const safeDate = visitedDate || todayDateInput();
      const visitedIso = `${safeDate}T12:00:00.000Z`;

      const saved = await upsertDiaryEntry({
        place_id: targetPlaceId,
        shop_label: trimmedLabel.slice(0, MAX_SHOP_LABEL_LENGTH),
        city: city.trim() ? city.trim().slice(0, MAX_GEO_LABEL_LENGTH) : null,
        country: country.trim() ? country.trim().slice(0, MAX_GEO_LABEL_LENGTH) : null,
        latitude: initialData?.latitude ?? null,
        longitude: initialData?.longitude ?? null,
        coords_expires_at: initialData?.coords_expires_at ?? null,
        score_overall: effectiveOverall,
        score_meat: scores.score_meat,
        score_bread: scores.score_bread,
        score_sauces: scores.score_sauces,
        score_value: scores.score_value,
        score_location: scoreLocation,
        note: note.trim().slice(0, MAX_DIARY_NOTE_LENGTH),
        visited_at: visitedIso,
      });

      if (convertFromWishlist && initialData?.place_id) {
        await deleteWishlistEntry(initialData.place_id);
      }

      triggerHaptic("light");
      notifyLocalDataChanged();
      onSaved?.(saved);
      onClose();
    } catch {
      setErrorMsg("Impossibile salvare la visita sul dispositivo.");
    } finally {
      setIsSaving(false);
    }
  };

  const isEditingExisting = Boolean(initialData?.place_id && !convertFromWishlist && initialData?.score_meat !== undefined);
  const modalTitle = convertFromWishlist
    ? "Converti Wishlist in Visita"
    : isEditingExisting
      ? "Modifica Voce Diario"
      : "Nuova Visita nel Diario";

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 font-quicksand"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diary-modal-title"
    >
      <div className="fixed inset-0 bg-neutral-950/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg bg-card text-foreground rounded-t-3xl sm:rounded-3xl border border-border shadow-dropdown max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 id="diary-modal-title" className="text-lg font-black uppercase tracking-tight text-foreground">
              {modalTitle}
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Salvato unicamente nel tuo dispositivo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi modale diario"
            className="size-9 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center border border-border flat-press"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="app-scroll p-5 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Nome Locale & Data Visita */}
          <div className="space-y-3">
            <div>
              <label htmlFor="diary-shop-label" className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1.5">
                Nome Locale *
              </label>
              <input
                id="diary-shop-label"
                data-testid="diary-shop-label-input"
                type="text"
                required
                maxLength={MAX_SHOP_LABEL_LENGTH}
                value={shopLabel}
                onChange={(e) => setShopLabel(e.target.value)}
                placeholder="Es. Sultan Kebap"
                className="w-full rounded-2xl bg-muted/40 border border-border px-3.5 py-2.5 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="diary-visited-at" className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                  <Calendar className="size-3" /> Data Visita
                </label>
                <input
                  id="diary-visited-at"
                  data-testid="diary-visited-date-input"
                  type="date"
                  value={visitedDate}
                  onChange={(e) => setVisitedDate(e.target.value)}
                  className="w-full rounded-2xl bg-muted/40 border border-border px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="diary-city" className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Città
                </label>
                <input
                  id="diary-city"
                  data-testid="diary-city-input"
                  type="text"
                  maxLength={MAX_GEO_LABEL_LENGTH}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Es. Milano"
                  className="w-full rounded-2xl bg-muted/40 border border-border px-3 py-2 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="diary-country" className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Nazione
                </label>
                <input
                  id="diary-country"
                  data-testid="diary-country-input"
                  type="text"
                  maxLength={MAX_GEO_LABEL_LENGTH}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Es. Italia"
                  className="w-full rounded-2xl bg-muted/40 border border-border px-3 py-2 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Voto Complessivo */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground">
                  Voto Complessivo
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-xl border text-xs font-black uppercase tracking-wider ${overallLevel.bg} ${overallLevel.color} ${overallLevel.border}`}>
                {effectiveOverall.toFixed(1)}/5 · {overallLevel.short}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setAutoOverall(true)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border flat-press ${
                  autoOverall
                    ? "bg-primary text-primary-foreground border-primary shadow-flat"
                    : "bg-card text-muted-foreground border-border"
                }`}
              >
                Auto ({computedAverage.toFixed(1)})
              </button>

              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((val) => {
                  const selected = !autoOverall && manualOverall === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      data-testid={`diary-overall-${val}`}
                      onClick={() => {
                        setAutoOverall(false);
                        setManualOverall(val);
                      }}
                      className={`size-8 rounded-xl text-xs font-black border flat-press ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary shadow-flat"
                          : "bg-card text-muted-foreground border-border hover:border-primary/40"
                      }`}
                      aria-label={`Voto complessivo ${val}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5 Dimensioni di Dettaglio */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Le 5 Dimensioni di Dettaglio
            </h3>

            {CORE_DIMENSIONS.map(({ dim, field, icon: Icon }) => {
              const meta = CATEGORY_META[dim];
              const currentVal = scores[field];
              const descriptor = COMPONENT_DESCRIPTORS[dim].find((d) => d.value === currentVal)?.label;

              return (
                <div key={dim} className="p-3 rounded-2xl bg-muted/30 border border-border space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-foreground">
                      <Icon className="size-3.5 text-primary" />
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          data-testid={`diary-${dim}-${val}`}
                          onClick={() => setScores((prev) => ({ ...prev, [field]: val }))}
                          className={`size-7 rounded-lg text-xs font-black border flat-press ${
                            currentVal === val
                              ? "bg-primary text-primary-foreground border-primary shadow-flat"
                              : "bg-card text-muted-foreground border-border hover:border-primary/40"
                          }`}
                          aria-label={`${meta.label} ${val}`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                  {descriptor && (
                    <p className="text-[11px] text-muted-foreground font-medium">{descriptor}</p>
                  )}
                </div>
              );
            })}

            {/* Location (5a dimensione, con opzione N/A) */}
            <div className="p-3 rounded-2xl bg-muted/30 border border-border space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-foreground">
                  <MapPin className="size-3.5 text-primary" />
                  {CATEGORY_META.location.label}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="diary-location-na"
                    onClick={() => setScoreLocation(null)}
                    className={`px-2 h-7 rounded-lg text-[10px] font-black border flat-press ${
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
                      data-testid={`diary-location-${val}`}
                      onClick={() => setScoreLocation(val)}
                      className={`size-7 rounded-lg text-xs font-black border flat-press ${
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
              <p className="text-[11px] text-muted-foreground font-medium">
                {scoreLocation === null
                  ? "Asporto o solo consegna (Location non valutata)"
                  : COMPONENT_DESCRIPTORS.location.find((d) => d.value === scoreLocation)?.label}
              </p>
            </div>
          </div>

          {/* Nota Breve */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="diary-note" className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Nota Personale Breve
              </label>
              <span className="text-[10px] font-bold text-muted-foreground">
                {note.length}/{MAX_DIARY_NOTE_LENGTH}
              </span>
            </div>
            <textarea
              id="diary-note"
              data-testid="diary-note-input"
              rows={3}
              maxLength={MAX_DIARY_NOTE_LENGTH}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. Carne succosa, salsa yogurt equilibrata, piadina calda..."
              className="w-full rounded-2xl bg-muted/40 border border-border px-3.5 py-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2.5 pt-1" style={{ paddingBottom: "var(--safe-b, 0px)" }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl border border-border bg-card hover:bg-muted text-foreground font-black text-xs uppercase tracking-wider flat-press"
            >
              Annulla
            </button>
            <button
              type="submit"
              data-testid="diary-submit-btn"
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider shadow-flat flat-press flex items-center justify-center gap-1.5"
            >
              <Check className="size-4" />
              {isSaving ? "Salvataggio..." : convertFromWishlist ? "Registra nel Diario" : "Salva Visita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
