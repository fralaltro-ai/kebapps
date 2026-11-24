"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  BookOpen,
  Calendar,
  Edit3,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import DiaryEntryModal, {
  notifyLocalDataChanged,
  type DiaryModalInitialData,
} from "@/components/diary/DiaryEntryModal";
import { SectionInfoButton } from "@/components/ui/SectionInfoButton";
import { useToast } from "@/context/ToastContext";
import { computePersonalGamification } from "@/lib/gamification";
import { getGoogleMapsPlaceLink } from "@/lib/geoUtils";
import { triggerHaptic } from "@/lib/haptics";
import {
  deleteDiaryEntry,
  listDiaryEntries,
} from "@/lib/local-storage/db";
import type { DiaryEntry } from "@/lib/local-storage/schema";
import { getLevelByValue } from "@/lib/ratingLabels";
import { cn } from "@/lib/utils";

type ScoreFilter = "all" | "4" | "5";
type DiarySort = "recent" | "score" | "name";

const SCORE_FILTERS: readonly { id: ScoreFilter; label: string; testId: string }[] = [
  { id: "all", label: "Tutti", testId: "diary-filter-all" },
  { id: "4", label: "4.0+", testId: "diary-filter-4" },
  { id: "5", label: "4.5+ Da Sogno", testId: "diary-filter-5" },
];

const SORT_OPTIONS: readonly { id: DiarySort; label: string; ariaLabel: string; testId: string }[] = [
  { id: "recent", label: "Recenti", ariaLabel: "Ordina per più recenti", testId: "diary-sort-recent" },
  { id: "score", label: "Voto", ariaLabel: "Ordina per voto più alto", testId: "diary-sort-score" },
  { id: "name", label: "A-Z", ariaLabel: "Ordina per nome A-Z", testId: "diary-sort-name" },
];

function formatDateLabel(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getDiaryMapsUrl(entry: DiaryEntry): string {
  const q = [entry.shop_label, entry.city, entry.country].filter(Boolean).join(", ");
  return getGoogleMapsPlaceLink(q, entry.place_id, entry.latitude, entry.longitude);
}

function DiaryPageContent() {
  const searchParams = useSearchParams();
  const { success: toastSuccess, error: toastError } = useToast();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [sortBy, setSortBy] = useState<DiarySort>("recent");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<DiaryModalInitialData | null>(null);

  const loadDiary = useCallback(async () => {
    try {
      const list = await listDiaryEntries();
      setEntries(list);
    } catch {
      toastError("Impossibile caricare il diario locale.");
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void loadDiary();
    const handleSync = () => {
      void loadDiary();
    };
    window.addEventListener("kebapps:local-data-changed", handleSync);
    return () => window.removeEventListener("kebapps:local-data-changed", handleSync);
  }, [loadDiary]);

  const processedParamRef = useRef<string | null>(null);

  useEffect(() => {
    const action = searchParams.get("action");
    const editPlaceId = searchParams.get("editPlaceId");
    if (!action && !editPlaceId) {
      processedParamRef.current = null;
      return;
    }
    const paramKey = `${action}:${editPlaceId}`;
    if (processedParamRef.current === paramKey) {
      return;
    }
    if (action === "new") {
      processedParamRef.current = paramKey;
      setModalInitialData(null);
      setIsModalOpen(true);
      return;
    }
    if (editPlaceId && entries.length > 0) {
      const target = entries.find((e) => e.place_id === editPlaceId);
      if (target) {
        processedParamRef.current = paramKey;
        setModalInitialData(target);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, entries]);

  useEffect(() => {
    if (confirmDeleteId === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmDeleteId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmDeleteId]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setModalInitialData(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("action") || params.has("editPlaceId") || params.has("place_id")) {
        window.history.replaceState(null, "", "/diary");
      }
    }
  }, []);

  const stats = useMemo(() => computePersonalGamification(entries), [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (scoreFilter === "4" && entry.score_overall < 4) return false;
      if (scoreFilter === "5" && entry.score_overall < 4.5) return false;
      if (!q) return true;
      return (
        entry.shop_label.toLowerCase().includes(q) ||
        (entry.city?.toLowerCase().includes(q) ?? false) ||
        (entry.country?.toLowerCase().includes(q) ?? false) ||
        entry.note.toLowerCase().includes(q)
      );
    });

    if (sortBy === "score") {
      return [...filtered].sort((a, b) => b.score_overall - a.score_overall);
    }
    if (sortBy === "name") {
      return [...filtered].sort((a, b) => a.shop_label.localeCompare(b.shop_label, "it"));
    }
    return filtered;
  }, [entries, searchQuery, scoreFilter, sortBy]);

  const handleOpenCreate = () => {
    triggerHaptic("light");
    setModalInitialData(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: DiaryEntry) => {
    triggerHaptic("light");
    setModalInitialData(entry);
    setIsModalOpen(true);
  };

  const handleDelete = async (placeId: string) => {
    try {
      await deleteDiaryEntry(placeId);
      setConfirmDeleteId(null);
      notifyLocalDataChanged();
      await loadDiary();
      toastSuccess("Voce eliminata dal Diario.");
    } catch {
      toastError("Impossibile eliminare la voce.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-card p-6 rounded-3xl border border-border shadow-flat flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <BookOpen className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Diario Personale
              </h1>
              <SectionInfoButton
                title="Diario Personale"
                subtitle="Valutazioni a 5 dimensioni, statistiche XP e Kebab Index locale."
                items={[
                  {
                    label: "Le 5 Dimensioni del Voto",
                    description:
                      "4 voti base obbligatori da 1 a 5 (Carne, Pane, Salse, Qualità/Prezzo) + Location opzionale. Se Location manca, la media resta bilanciata sui 4 voti base.",
                  },
                  {
                    label: "Etichette Esperienziali",
                    description:
                      "La media genera il verdetto: Da Sogno (≥ 4.5), Garanzia (≥ 4.0), Buon Alleato (≥ 3.0), Spuntino Smart (≥ 2.0), In Esplorazione (< 2.0).",
                  },
                  {
                    label: "Impatto su XP & Kebab Index",
                    description:
                      "Ogni locale unico vale +10 XP (+15 XP città, +25 XP nazione); compilare Location (+25%) e Nota (+25%) porta la scheda al 100% del Kebab Index.",
                  },
                ]}
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              {stats.counters.totalVisits} visite · Media{" "}
              {stats.counters.averageOverallScore !== null
                ? `${stats.counters.averageOverallScore.toFixed(1)}/5`
                : "–"}{" "}
              · Kebab Index {stats.kebabIndex}%
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="diary-add-btn"
          onClick={handleOpenCreate}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl shadow-flat flat-press inline-flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="size-4" />
          Aggiungi Kebab
        </button>
      </section>

      {/* Filters & Search */}
      <section className="bg-card p-3.5 sm:p-4 rounded-3xl border border-border shadow-flat space-y-2.5">
        {/* Row 1: Full-width search input with clear button */}
        <div className="relative w-full">
          <Search className="size-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            inputMode="search"
            data-testid="diary-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca locale, città o nota..."
            aria-label="Cerca nel diario"
            className="w-full min-h-[44px] rounded-2xl bg-muted/40 border border-border pl-10 pr-11 py-2.5 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          {searchQuery.length > 0 && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <button
                type="button"
                data-testid="diary-search-clear-btn"
                aria-label="Svuota ricerca"
                onClick={() => {
                  triggerHaptic("light");
                  setSearchQuery("");
                }}
                className="size-9 rounded-xl bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border flex items-center justify-center transition-colors flat-press"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Single-row compact score filter + custom sort pills */}
        <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain sm:justify-between">
          <div
            role="group"
            aria-label="Filtra per voto"
            className="flex items-center gap-1.5 shrink-0"
          >
            {SCORE_FILTERS.map((chip) => {
              const active = scoreFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  data-testid={chip.testId}
                  aria-pressed={active}
                  onClick={() => {
                    triggerHaptic("light");
                    setScoreFilter(chip.id);
                  }}
                  className={cn(
                    "min-h-[40px] px-3 rounded-xl text-[11px] font-black uppercase tracking-wider border whitespace-nowrap shrink-0 inline-flex items-center justify-center transition-colors flat-press",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-flat"
                      : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <span className="h-6 w-px bg-border shrink-0" aria-hidden="true" />

          <div
            role="group"
            aria-label="Ordina diario"
            className="flex items-center gap-1.5 shrink-0"
          >
            <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            {SORT_OPTIONS.map((option) => {
              const active = sortBy === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  data-testid={option.testId}
                  aria-label={option.ariaLabel}
                  aria-pressed={active}
                  onClick={() => {
                    triggerHaptic("light");
                    setSortBy(option.id);
                  }}
                  className={cn(
                    "min-h-[40px] px-3 rounded-xl text-[11px] font-black uppercase tracking-wider border whitespace-nowrap shrink-0 inline-flex items-center justify-center transition-colors flat-press",
                    active
                      ? "bg-foreground text-background border-foreground shadow-flat"
                      : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Entries List */}
      {isLoading ? (
        <div className="bg-card p-8 rounded-3xl border border-border text-center text-sm font-bold text-muted-foreground">
          Caricamento diario locale...
        </div>
      ) : filteredEntries.length === 0 ? (
        <section className="bg-card p-8 rounded-3xl border border-border shadow-flat text-center space-y-4">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
            <Sparkles className="size-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-foreground">
              {entries.length === 0 ? "Il tuo Diario è ancora vuoto" : "Nessun risultato trovato"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-md mx-auto">
              {entries.length === 0
                ? "Registra il tuo primo kebab manualmente oppure esplora la mappa per scegliere un locale."
                : "Prova a modificare i filtri o il testo di ricerca."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest shadow-flat flat-press inline-flex items-center gap-2"
            >
              <Plus className="size-4" /> Inserisci Visita
            </button>
            <Link
              href="/map"
              className="px-5 py-3 rounded-2xl bg-card border border-border hover:bg-muted text-foreground font-black text-xs uppercase tracking-widest flat-press inline-flex items-center gap-2"
            >
              <MapPin className="size-4 text-primary" /> Apri Mappa
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-4" aria-label="Elenco voci diario">
          {filteredEntries.map((entry) => {
            const level = getLevelByValue(entry.score_overall);
            const locationLabel = [entry.city, entry.country].filter(Boolean).join(", ");
            const isConfirmingDelete = confirmDeleteId === entry.place_id;

            return (
              <article
                key={entry.place_id}
                data-testid={`diary-entry-${entry.place_id}`}
                className="bg-card p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-border shadow-flat space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-black text-foreground leading-tight break-words">
                      {entry.shop_label}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3.5 text-primary" />
                        {formatDateLabel(entry.visited_at)}
                      </span>
                      {locationLabel && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5 text-primary" />
                          {locationLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider shrink-0 ${level.bg} ${level.color} ${level.border}`}
                  >
                    <Star className="size-3.5 fill-current" />
                    <span>{entry.score_overall.toFixed(1)}/5</span>
                    <span className="hidden sm:inline">· {level.short}</span>
                  </div>
                </div>

                {/* 5 Dimensions */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: "Carne", value: entry.score_meat },
                    { label: "Pane", value: entry.score_bread },
                    { label: "Salse", value: entry.score_sauces },
                    { label: "Q/P", value: entry.score_value },
                    { label: "Loc.", value: entry.score_location },
                  ].map((dim) => (
                    <div
                      key={dim.label}
                      className="px-1.5 py-1.5 rounded-xl bg-muted/40 border border-border flex flex-col items-center justify-center text-center"
                    >
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight text-muted-foreground truncate w-full">
                        {dim.label}
                      </span>
                      <span className="text-xs font-black text-foreground tabular-nums mt-0.5">
                        {dim.value !== null ? `${dim.value}/5` : "–"}
                      </span>
                    </div>
                  ))}
                </div>

                {entry.note && (
                  <p className="px-3 py-1.5 rounded-xl bg-muted/30 border border-border text-xs font-medium text-foreground leading-snug line-clamp-2 sm:line-clamp-3">
                    &ldquo;{entry.note}&rdquo;
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="diary-edit-btn"
                      onClick={() => handleOpenEdit(entry)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 border border-border hover:border-primary/30 text-xs font-black uppercase tracking-wider text-foreground hover:text-primary flat-press inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="size-3.5" /> Modifica
                    </button>

                    <a
                      href={getDiaryMapsUrl(entry)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs font-black uppercase tracking-wider text-foreground flat-press inline-flex items-center gap-1.5"
                    >
                      <span className="hidden sm:inline">Google Maps</span>
                      <span className="sm:hidden">Maps</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="diary-confirm-delete-btn"
                        onClick={() => void handleDelete(entry.place_id)}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-black uppercase tracking-wider flat-press"
                      >
                        Conferma
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground"
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="diary-delete-btn"
                      onClick={() => setConfirmDeleteId(entry.place_id)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-card hover:bg-destructive/10 border border-border hover:border-destructive/30 text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-destructive flat-press inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="size-3.5" /> Elimina
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <DiaryEntryModal
        isOpen={isModalOpen}
        initialData={modalInitialData}
        onClose={handleCloseModal}
        onSaved={() => {
          handleCloseModal();
          void loadDiary();
          toastSuccess("Visita salvata nel Diario!");
        }}
      />
    </div>
  );
}

export default function DiaryClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background">
          <div className="w-16 h-1 bg-muted overflow-hidden rounded-full" />
        </div>
      }
    >
      <DiaryPageContent />
    </Suspense>
  );
}
