"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Calendar,
  Check,
  Edit3,
  ExternalLink,
  MapPin,
  Navigation,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import DiaryEntryModal, {
  notifyLocalDataChanged,
  type DiaryModalInitialData,
} from "@/components/diary/DiaryEntryModal";
import { SectionInfoButton } from "@/components/ui/SectionInfoButton";
import { useToast } from "@/context/ToastContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useGpsConsent } from "@/hooks/useGpsConsent";
import {
  calculateHaversineDistance,
  formatDistance,
  getGoogleMapsPlaceLink,
} from "@/lib/geoUtils";
import { triggerHaptic } from "@/lib/haptics";
import {
  deleteWishlistEntry,
  listDiaryEntries,
  listWishlistEntries,
  upsertWishlistEntry,
} from "@/lib/local-storage/db";
import {
  MAX_SHOP_LABEL_LENGTH,
  MAX_WISHLIST_NOTE_LENGTH,
  type DiaryEntry,
  type WishlistEntry,
} from "@/lib/local-storage/schema";
import { sortWishlistByDistance } from "@/lib/wishlistSort";

type WishlistSortMode = "date" | "distance";

function formatShortDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getWishlistMapsUrl(item: WishlistEntry): string {
  return getGoogleMapsPlaceLink(item.shop_label, item.place_id, item.latitude, item.longitude);
}

export default function WishlistClient() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { status: gpsConsentStatus, grantGpsConsent } = useGpsConsent();
  const { position, requestPosition } = useGeolocation();

  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [diaryMap, setDiaryMap] = useState<Map<string, DiaryEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [sortMode, setSortMode] = useState<WishlistSortMode>("date");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [editingNotePlaceId, setEditingNotePlaceId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");

  const [convertTarget, setConvertTarget] = useState<DiaryModalInitialData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [wishlistEntries, diaryEntries] = await Promise.all([
        listWishlistEntries(),
        listDiaryEntries(),
      ]);
      setItems(wishlistEntries);
      setDiaryMap(new Map(diaryEntries.map((d) => [d.place_id, d])));
    } catch {
      toastError("Impossibile caricare la wishlist locale.");
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void loadData();
    const handleSync = () => {
      void loadData();
    };
    window.addEventListener("kebapps:local-data-changed", handleSync);
    return () => window.removeEventListener("kebapps:local-data-changed", handleSync);
  }, [loadData]);

  const enrichedAndSorted = useMemo(() => {
    const withDistance = items.map((entry) => {
      const distanceKm =
        gpsConsentStatus === "granted" &&
        position &&
        entry.latitude !== null &&
        entry.longitude !== null
          ? calculateHaversineDistance(position, {
              lat: entry.latitude,
              lng: entry.longitude,
            })
          : null;
      const diaryEntry = diaryMap.get(entry.place_id);
      return {
        entry,
        id: entry.place_id,
        has_reviewed: Boolean(diaryEntry),
        diaryEntry,
        distanceKm,
      };
    });

    if (sortMode === "distance") {
      return sortWishlistByDistance(withDistance);
    }

    return [...withDistance].sort((a, b) => {
      const diff = Date.parse(b.entry.added_at) - Date.parse(a.entry.added_at);
      if (diff !== 0) return diff;
      return a.entry.shop_label.localeCompare(b.entry.shop_label, "it");
    });
  }, [items, diaryMap, gpsConsentStatus, position, sortMode]);

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || isAdding) return;

    setIsAdding(true);
    try {
      const placeId = `wish_local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await upsertWishlistEntry({
        place_id: placeId,
        shop_label: trimmed.slice(0, MAX_SHOP_LABEL_LENGTH),
        note: newNote.trim().slice(0, MAX_WISHLIST_NOTE_LENGTH),
      });
      setNewName("");
      setNewNote("");
      setShowAddForm(false);
      notifyLocalDataChanged();
      await loadData();
      toastSuccess("Locale aggiunto alla Wishlist!");
    } catch {
      toastError("Impossibile salvare il locale nella Wishlist.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveNote = async (entry: WishlistEntry) => {
    try {
      await upsertWishlistEntry({
        place_id: entry.place_id,
        shop_label: entry.shop_label,
        note: editingNoteValue.trim().slice(0, MAX_WISHLIST_NOTE_LENGTH),
        latitude: entry.latitude,
        longitude: entry.longitude,
        coords_expires_at: entry.coords_expires_at,
        sort_order: entry.sort_order,
        added_at: entry.added_at,
      });
      setEditingNotePlaceId(null);
      notifyLocalDataChanged();
      await loadData();
      toastSuccess("Nota aggiornata.");
    } catch {
      toastError("Impossibile aggiornare la nota.");
    }
  };

  const handleRemove = async (placeId: string) => {
    try {
      await deleteWishlistEntry(placeId);
      notifyLocalDataChanged();
      await loadData();
      toastSuccess("Rimosso dalla Wishlist.");
    } catch {
      toastError("Impossibile rimuovere dalla Wishlist.");
    }
  };

  const handleSortByDistance = () => {
    triggerHaptic("light");
    setSortMode("distance");
    if (gpsConsentStatus === "granted") {
      requestPosition();
    }
  };

  const handleEnableGps = () => {
    grantGpsConsent();
    requestPosition();
    setSortMode("distance");
    toastSuccess("GPS attivato per ordinamento offline.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-card p-6 rounded-3xl border border-border shadow-flat flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Bookmark className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Wishlist Locale
              </h1>
              <SectionInfoButton
                title="Wishlist Locale"
                subtitle="Salva i kebab che vuoi provare senza connessione né account."
                items={[
                  {
                    label: "Ordinamento Data vs Distanza Offline",
                    description:
                      "L'ordinamento per distanza usa la formula geodetica di Haversine (R = 6371 km) calcolata interamente offline rispetto all'ultima posizione GPS nota, senza chiamate API.",
                  },
                  {
                    label: "Conversione 1-Tap in Visita",
                    description:
                      "Premendo 'Converti in Visita' apri il modulo Diario precompilato con nome e coordinate del locale; una volta salvato puoi rimuoverlo dalla Wishlist.",
                  },
                ]}
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              {items.length} {items.length === 1 ? "locale salvato" : "locali salvati"} sul tuo dispositivo
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="wishlist-add-btn"
          onClick={() => {
            triggerHaptic("light");
            setShowAddForm((prev) => !prev);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl shadow-flat flat-press inline-flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="size-4" />
          Aggiungi Locale
        </button>
      </section>

      {/* Manual Add Form */}
      {showAddForm && (
        <form
          onSubmit={(e) => void handleAddManual(e)}
          className="bg-card p-5 rounded-3xl border border-primary/30 shadow-flat space-y-3 animate-in fade-in duration-200"
        >
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
            Nuovo Locale da Provare
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              data-testid="wishlist-new-name-input"
              required
              maxLength={MAX_SHOP_LABEL_LENGTH}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome locale (es. Anatolia Kebab)"
              className="rounded-2xl bg-muted/40 border border-border px-3.5 py-2.5 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              data-testid="wishlist-new-note-input"
              maxLength={MAX_WISHLIST_NOTE_LENGTH}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Nota breve (es. Consigliato da Luca)"
              className="rounded-2xl bg-muted/40 border border-border px-3.5 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-black uppercase tracking-wider text-muted-foreground flat-press"
            >
              Annulla
            </button>
            <button
              type="submit"
              data-testid="wishlist-save-new-btn"
              disabled={isAdding}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider shadow-flat flat-press inline-flex items-center gap-1.5"
            >
              <Check className="size-3.5" /> Salva in Wishlist
            </button>
          </div>
        </form>
      )}

      {/* Sort Selector + GPS Offline Status */}
      <section className="bg-card p-4 rounded-3xl border border-border shadow-flat flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mr-1">
            Ordina per:
          </span>
          <button
            type="button"
            data-testid="wishlist-sort-date"
            onClick={() => {
              triggerHaptic("light");
              setSortMode("date");
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border flat-press inline-flex items-center gap-1.5 ${
              sortMode === "date"
                ? "bg-primary text-primary-foreground border-primary shadow-flat"
                : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <Calendar className="size-3.5" /> Data Aggiunta
          </button>
          <button
            type="button"
            data-testid="wishlist-sort-distance"
            onClick={handleSortByDistance}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border flat-press inline-flex items-center gap-1.5 ${
              sortMode === "distance"
                ? "bg-primary text-primary-foreground border-primary shadow-flat"
                : "bg-muted/50 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <Navigation className="size-3.5" /> Distanza GPS (Offline)
          </button>
        </div>

        {gpsConsentStatus !== "granted" && (
          <button
            type="button"
            onClick={handleEnableGps}
            className="text-xs font-black text-primary hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <MapPin className="size-3.5" /> Attiva GPS per calcolo distanza offline
          </button>
        )}
      </section>

      {/* Wishlist Items */}
      {isLoading ? (
        <div className="bg-card p-8 rounded-3xl border border-border text-center text-sm font-bold text-muted-foreground">
          Caricamento wishlist locale...
        </div>
      ) : enrichedAndSorted.length === 0 ? (
        <section className="bg-card p-8 rounded-3xl border border-border shadow-flat text-center space-y-4">
          <div className="size-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/25">
            <Bookmark className="size-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-foreground">Nessun locale in Wishlist</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-md mx-auto">
              Salva un kebab dalla Mappa oppure aggiungine uno manualmente per tenerlo a portata di mano.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest shadow-flat flat-press inline-flex items-center gap-2"
            >
              <Plus className="size-4" /> Aggiungi Manualmente
            </button>
            <Link
              href="/map"
              className="px-5 py-3 rounded-2xl bg-card border border-border hover:bg-muted text-foreground font-black text-xs uppercase tracking-widest flat-press inline-flex items-center gap-2"
            >
              <MapPin className="size-4 text-primary" /> Scopri sulla Mappa
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-4" aria-label="Elenco wishlist locale">
          {enrichedAndSorted.map(({ entry, distanceKm, has_reviewed, diaryEntry }) => {
            const isEditingNote = editingNotePlaceId === entry.place_id;

            return (
              <article
                key={entry.place_id}
                data-testid={`wishlist-item-${entry.place_id}`}
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
                        Salvato il {formatShortDate(entry.added_at)}
                      </span>
                      {distanceKm !== null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-black">
                          <MapPin className="size-3" /> {formatDistance(distanceKm)}
                        </span>
                      )}
                      {has_reviewed && diaryEntry && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black">
                          <Star className="size-3 fill-current" /> Nel Diario ({diaryEntry.score_overall.toFixed(1)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Note Editor */}
                {isEditingNote ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      data-testid="wishlist-edit-note-input"
                      maxLength={MAX_WISHLIST_NOTE_LENGTH}
                      value={editingNoteValue}
                      onChange={(e) => setEditingNoteValue(e.target.value)}
                      placeholder="Nota personale breve..."
                      className="flex-1 rounded-xl bg-muted/40 border border-border px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        data-testid="wishlist-save-note-btn"
                        onClick={() => void handleSaveNote(entry)}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider flat-press"
                      >
                        Salva Nota
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNotePlaceId(null)}
                        className="px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-bold"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : entry.note ? (
                  <div className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground/90 break-words leading-snug">
                      {entry.note}
                    </p>
                    <button
                      type="button"
                      data-testid="wishlist-edit-note-btn"
                      onClick={() => {
                        setEditingNotePlaceId(entry.place_id);
                        setEditingNoteValue(entry.note);
                      }}
                      className="text-[11px] font-black uppercase tracking-wider text-primary hover:underline shrink-0 inline-flex items-center gap-1 pt-0.5"
                    >
                      <Edit3 className="size-3" /> Modifica
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      type="button"
                      data-testid="wishlist-edit-note-btn"
                      onClick={() => {
                        setEditingNotePlaceId(entry.place_id);
                        setEditingNoteValue("");
                      }}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-bold text-muted-foreground hover:text-primary hover:bg-muted/50 inline-flex items-center gap-1.5 transition-colors flat-press"
                    >
                      <Edit3 className="size-3" /> Aggiungi nota
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    data-testid="wishlist-convert-btn"
                    onClick={() => {
                      triggerHaptic("light");
                      setConvertTarget({
                        place_id: entry.place_id,
                        shop_label: entry.shop_label,
                        latitude: entry.latitude,
                        longitude: entry.longitude,
                        coords_expires_at: entry.coords_expires_at,
                        note: entry.note,
                      });
                    }}
                    className="flex-1 min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5 flat-press"
                  >
                    <Star className="size-3.5" /> Converti in Visita
                  </button>

                  <a
                    href={getWishlistMapsUrl(entry)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl bg-muted hover:bg-border text-foreground font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5 flat-press shrink-0"
                  >
                    <span className="hidden sm:inline">Google Maps</span>
                    <span className="sm:hidden">Maps</span>
                    <ExternalLink className="size-3.5" />
                  </a>

                  <button
                    type="button"
                    data-testid="wishlist-remove-btn"
                    aria-label="Rimuovi dalla wishlist"
                    onClick={() => void handleRemove(entry.place_id)}
                    className="min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5 flat-press shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="hidden sm:inline">Rimuovi</span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <DiaryEntryModal
        isOpen={convertTarget !== null}
        initialData={convertTarget}
        convertFromWishlist={true}
        onClose={() => setConvertTarget(null)}
        onSaved={() => {
          setConvertTarget(null);
          void loadData();
          toastSuccess("Visita registrata nel Diario e rimossa dalla Wishlist!");
        }}
      />
    </div>
  );
}
