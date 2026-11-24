"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Bookmark,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Globe,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Utensils,
} from "lucide-react";
import { getAvatarSrc } from "@/lib/avatars";
import { InfoDialog, type InfoAccentTheme, type SectionInfoItem } from "@/components/ui/InfoDialog";
import { computePersonalGamification } from "@/lib/gamification";
import { getGoogleMapsPlaceLink } from "@/lib/geoUtils";
import { triggerHaptic } from "@/lib/haptics";
import {
  getLocalProfile,
  listDiaryEntries,
  listWishlistEntries,
} from "@/lib/local-storage/db";
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_NICKNAME,
  type DiaryEntry,
  type LocalProfile,
  type WishlistEntry,
} from "@/lib/local-storage/schema";
import { cn } from "@/lib/utils";

type HomeModalKey =
  | "local-guide"
  | "visits"
  | "unique-shops"
  | "cities-countries"
  | "wishlist"
  | "kebab-index";

interface StatCardMeta {
  id: Exclude<HomeModalKey, "local-guide">;
  testId: string;
  valueTestId: string;
  label: string;
  accent: InfoAccentTheme;
  icon: typeof Utensils;
  cardClassName?: string;
  triggerClassName: string;
  iconWrapClassName: string;
  hintIconClassName: string;
}

const STAT_CARDS_META: readonly StatCardMeta[] = [
  {
    id: "visits",
    testId: "stat-card-visits",
    valueTestId: "stat-total-visits",
    label: "Kebab Visitati",
    accent: "primary",
    icon: Utensils,
    triggerClassName: "hover:border-primary/45 focus-visible:ring-primary",
    iconWrapClassName: "bg-primary/10 text-primary",
    hintIconClassName: "text-muted-foreground/70 group-hover:text-primary",
  },
  {
    id: "unique-shops",
    testId: "stat-card-unique-shops",
    valueTestId: "stat-unique-shops",
    label: "Locali Unici",
    accent: "amber",
    icon: Store,
    triggerClassName: "hover:border-amber-500/50 focus-visible:ring-amber-500",
    iconWrapClassName: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    hintIconClassName: "text-muted-foreground/70 group-hover:text-amber-600 dark:group-hover:text-amber-400",
  },
  {
    id: "cities-countries",
    testId: "stat-card-cities-countries",
    valueTestId: "stat-cities-countries",
    label: "Città / Nazioni",
    accent: "blue",
    icon: Globe,
    triggerClassName: "hover:border-blue-500/50 focus-visible:ring-blue-500",
    iconWrapClassName: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    hintIconClassName: "text-muted-foreground/70 group-hover:text-blue-600 dark:group-hover:text-blue-400",
  },
  {
    id: "wishlist",
    testId: "stat-card-wishlist",
    valueTestId: "stat-wishlist-count",
    label: "In Wishlist",
    accent: "emerald",
    icon: Bookmark,
    triggerClassName: "hover:border-emerald-500/50 focus-visible:ring-emerald-500",
    iconWrapClassName: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    hintIconClassName: "text-muted-foreground/70 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
  },
  {
    id: "kebab-index",
    testId: "stat-card-kebab-index",
    valueTestId: "stat-kebab-index",
    label: "Kebab Index",
    accent: "purple",
    icon: Award,
    cardClassName: "col-span-2 sm:col-span-1",
    triggerClassName: "hover:border-purple-500/50 focus-visible:ring-purple-500",
    iconWrapClassName: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    hintIconClassName: "text-muted-foreground/70 group-hover:text-purple-600 dark:group-hover:text-purple-400",
  },
];

function formatShortDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildMapsUrl(shopLabel: string, placeId: string, lat: number | null, lng: number | null): string {
  return getGoogleMapsPlaceLink(shopLabel, placeId, lat, lng);
}

export default function HomeClient() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<HomeModalKey | null>(null);

  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [loadedProfile, loadedDiary, loadedWishlist] = await Promise.all([
        getLocalProfile(),
        listDiaryEntries(),
        listWishlistEntries(),
      ]);
      setProfile(loadedProfile);
      setDiary(loadedDiary);
      setWishlist(loadedWishlist);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
    const handleSync = () => {
      void loadDashboardData();
    };
    window.addEventListener("kebapps:local-data-changed", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("kebapps:local-data-changed", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [loadDashboardData]);

  const stats = computePersonalGamification(diary);
  const activeNickname = profile?.nickname || DEFAULT_NICKNAME;
  const activeAvatarSrc = getAvatarSrc(profile?.avatar_id ?? DEFAULT_AVATAR_ID);
  const recentDiary = diary.slice(0, 3);
  const recentWishlist = wishlist.slice(0, 3);

  const openModal = (key: HomeModalKey, triggerEl: HTMLButtonElement) => {
    triggerHaptic("light");
    lastTriggerRef.current = triggerEl;
    setActiveModal(key);
  };

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const statValues: Record<Exclude<HomeModalKey, "local-guide">, string> = {
    visits: isLoading ? "–" : String(stats.counters.totalVisits),
    "unique-shops": isLoading ? "–" : String(stats.counters.uniqueShops),
    "cities-countries": isLoading
      ? "–"
      : `${stats.counters.citiesExplored} / ${stats.counters.countriesExplored}`,
    wishlist: isLoading ? "–" : String(wishlist.length),
    "kebab-index": isLoading ? "–" : `${stats.kebabIndex}%`,
  };

  const getModalConfig = (
    key: HomeModalKey
  ): {
    title: string;
    subtitle: string;
    badgeLabel: string;
    accent: InfoAccentTheme;
    icon: React.ReactNode;
    valueLabel?: string;
    items: SectionInfoItem[];
    footerNote: string;
  } => {
    switch (key) {
      case "local-guide":
        return {
          title: "Cos'è KebApps",
          subtitle:
            "Scopri locali che vendono kebab, kebabbari di quartiere e street food mediorientale sulla mappa, registrando le tue degustazioni in locale senza account né database remoti.",
          badgeLabel: "Guida Local-First",
          accent: "primary",
          icon: <ShieldCheck className="size-5" />,
          items: [
            {
              label: "Locali che vendono kebab sulla mappa",
              accent: "primary",
              description:
                "Cerca città o indirizzi con ricerca On-Submit, esplora la mappa interattiva dietro consenso esplicito e salva i locali direttamente sul dispositivo.",
            },
            {
              label: "Diario personale a 5 dimensioni",
              accent: "amber",
              description:
                "Valuta carne, pane, salse, rapporto qualità/prezzo e location con note fino a 280 caratteri, punteggi XP locali e calcolo automatico del Kebab Index.",
            },
            {
              label: "Wishlist offline e Backup JSON",
              accent: "emerald",
              description:
                "Ordina i kebabbari da provare per distanza geodetica Haversine offline, converti una tappa in visita con un tocco ed esporta i dati in JSON.",
            },
          ],
          footerNote:
            "Tutti i dati vengono archiviati solo nel browser tramite IndexedDB e sono esportabili in JSON dalle impostazioni del Profilo.",
        };
      case "visits":
        return {
          title: "Kebab Visitati",
          subtitle: "Conteggio totale delle degustazioni salvate nel tuo Diario personale.",
          badgeLabel: "Statistica Diario",
          accent: "primary",
          icon: <Utensils className="size-5" />,
          valueLabel: `${stats.counters.totalVisits} visite`,
          items: [
            {
              label: "Archiviazione IndexedDB Locale",
              description:
                "Ogni visita registrata nel Diario viene salvata esclusivamente nella memoria locale del dispositivo (IndexedDB), disponibile anche offline.",
            },
            {
              label: "Visite Totali vs Locali Unici",
              description:
                "Kebab Visitati conta tutte le voci registrate nel Diario; Locali Unici distingue invece quanti kebab shops diversi hai recensito.",
            },
          ],
          footerNote: "Le visite sono sempre modificabili, filtrabili ed esportabili in JSON.",
        };
      case "unique-shops":
        return {
          title: "Locali Unici",
          subtitle: "Numero di kebab shop distinti presenti nel tuo Diario.",
          badgeLabel: "Progressione XP",
          accent: "amber",
          icon: <Store className="size-5" />,
          valueLabel: `${stats.counters.uniqueShops} locali · +${stats.xp.xpFromVisits} XP`,
          items: [
            {
              label: "+10 XP per Locale Distinto",
              description:
                "Ogni locale unico registrato nel Diario conferisce +10 XP verso i 5 ranghi personali (da Pivello dello Spiedo a Maestro dello Spiedo).",
            },
            {
              label: "Nessun Duplicato XP",
              description:
                "I punti vengono calcolati per identificativo unico del locale (place_id), così da premiare la scoperta di nuovi posti senza duplicati XP sullo stesso locale.",
            },
          ],
          footerNote: "Sblocchi il badge Pioniere appena registri il primo locale unico.",
        };
      case "cities-countries":
        return {
          title: "Città & Nazioni Esplorate",
          subtitle: "Bonus XP geografico e progressione verso i badge di esplorazione.",
          badgeLabel: "Esplorazione",
          accent: "blue",
          icon: <Globe className="size-5" />,
          valueLabel: `${stats.counters.citiesExplored} città · ${stats.counters.countriesExplored} nazioni`,
          items: [
            {
              label: "Bonus +15 XP Città / +25 XP Nazione",
              description:
                "Ogni città unica annotata nel Diario aggiunge +15 XP (+15 XP/città) e ogni nazione unica aggiunge +25 XP (+25 XP/nazione) al tuo totale.",
            },
            {
              label: "Impatto sui Badge Personali",
              description:
                "Questo contatore alimenta direttamente i badge Esploratore (5 città), Gourmet (15 città) e Globetrotter (3 nazioni).",
            },
          ],
          footerNote: "Ricordati di indicare città e nazione nelle schede del Diario per ottenere il bonus.",
        };
      case "wishlist":
        return {
          title: "Locali in Wishlist",
          subtitle: "La tua lista desideri offline dei kebabbari da provare.",
          badgeLabel: "Lista Desideri",
          accent: "emerald",
          icon: <Bookmark className="size-5" />,
          valueLabel: `${wishlist.length} salvati`,
          items: [
            {
              label: "Lista Offline & Distanza Haversine",
              description:
                "Puoi aggiungere locali dalla Mappa o manualmente con una nota breve e ordinarli per data o per distanza geodetica offline (Haversine) con GPS attivo.",
            },
            {
              label: "Conversione 1-Tap in Diario",
              description:
                "Quando provi un locale in Wishlist, il pulsante 'Converti in Visita' apre il modulo Diario precompilato e rimuove il locale dalla lista al salvataggio.",
            },
          ],
          footerNote: "La Wishlist è inclusa nei Backup JSON esportabili dal Profilo.",
        };
      case "kebab-index":
        return {
          title: "Kebab Index",
          subtitle: "Indicatore percentuale medio di completezza delle tue schede Diario.",
          badgeLabel: "Qualità Schede",
          accent: "purple",
          icon: <Award className="size-5" />,
          valueLabel: `${stats.kebabIndex}%`,
          items: [
            {
              label: "50% · I 4 Voti Base",
              description:
                "Compilare le 4 dimensioni principali (Carne, Pane, Salse, Qualità/Prezzo) assegna subito il 50% di completezza alla scheda.",
            },
            {
              label: "+25% Voto Location · +25% Nota Personale",
              description:
                "Aggiungere il voto facoltativo Location vale +25% e scrivere una nota personale di degustazione vale gli ultimi +25%, portando la scheda al 100%.",
            },
          ],
          footerNote: "Se nessuna visita è presente nel Diario, il Kebab Index è 0%.",
        };
    }
  };

  const activeModalConfig = activeModal ? getModalConfig(activeModal) : null;

  return (
    <div className="space-y-6">
      {/* Compact Local Profile + Hero CTA */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-card text-foreground p-6 rounded-3xl border border-border shadow-flat flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <button
              type="button"
              data-testid="hero-local-guide-btn"
              onClick={(e) => openModal("local-guide", e.currentTarget)}
              aria-label="Scopri cos'è KebApps: guida local-first"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 hover:border-primary/40 text-xs font-black uppercase tracking-wider text-primary flat-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ShieldCheck className="size-4 shrink-0" />
              <span>Dati 100% sul Dispositivo &amp; Senza Account</span>
              <CircleHelp className="size-3.5 opacity-80 shrink-0" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">
              Il tuo Diario Kebab personale.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-xl">
              Scopri i locali che vendono kebab sulla mappa, annota voti e preferenze sul tuo dispositivo e tieni traccia della tua Wishlist.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              href="/map"
              onClick={() => triggerHaptic("light")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl shadow-flat flat-press inline-flex items-center gap-2"
            >
              <MapPin className="size-4" />
              Esplora la Mappa
            </Link>
            <Link
              href="/diary"
              onClick={() => triggerHaptic("light")}
              className="bg-card hover:bg-muted text-foreground border border-border font-black text-xs uppercase tracking-widest px-4 py-3 rounded-2xl shadow-sm flat-press inline-flex items-center gap-2"
            >
              <BookOpen className="size-4 text-primary" />
              Diario Personale
            </Link>
            <Link
              href="/wishlist"
              onClick={() => triggerHaptic("light")}
              className="bg-card hover:bg-muted text-foreground border border-border font-black text-xs uppercase tracking-widest px-4 py-3 rounded-2xl shadow-sm flat-press inline-flex items-center gap-2"
            >
              <Bookmark className="size-4 text-amber-500" />
              Wishlist
            </Link>
          </div>
        </div>

        {/* User Summary Card */}
        <Link
          href="/profile"
          onClick={() => triggerHaptic("light")}
          className="lg:col-span-2 bg-card hover:bg-muted/30 p-5 sm:p-6 rounded-3xl border border-border shadow-flat flex flex-col justify-between gap-4 flat-press group"
        >
          <div className="flex items-center gap-3.5">
            <div className="size-14 rounded-2xl bg-primary/10 border border-primary/25 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeAvatarSrc}
                alt={activeNickname}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Profilo Locale
                </span>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <h2 data-testid="home-profile-nickname" className="text-lg font-black text-foreground truncate">
                {activeNickname}
              </h2>
              <p className="text-xs font-bold text-muted-foreground truncate">
                {stats.level.current.level}
              </p>
            </div>
          </div>

          <div className="space-y-2 bg-muted/50 p-3.5 rounded-2xl border border-border">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                {stats.xp.totalXp} XP
              </span>
              <span className="text-muted-foreground">
                {stats.level.next
                  ? `${stats.level.xpToNextLevel} XP al prossimo livello`
                  : "Livello Massimo"}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-card border border-border overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${stats.level.progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{stats.level.current.title}</span>
              <span>{stats.level.progressPct}%</span>
            </div>
          </div>
        </Link>
      </section>

      {/* Personal Counters Grid */}
      <section aria-label="Statistiche personali" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-xs font-black uppercase tracking-wider text-foreground">
              Statistiche &amp; XP Personali
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_CARDS_META.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                data-testid={card.testId}
                aria-label={`Dettagli su ${card.label}`}
                onClick={(e) => openModal(card.id, e.currentTarget)}
                className={cn(
                  "group bg-card p-4 rounded-3xl border border-border shadow-flat flex flex-col items-start text-left gap-1.5 w-full flat-press transition-colors focus-visible:outline-none focus-visible:ring-2",
                  card.cardClassName,
                  card.triggerClassName
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className={cn(
                      "size-8 rounded-xl flex items-center justify-center",
                      card.iconWrapClassName
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <Info
                    className={cn("size-3.5 transition-colors shrink-0", card.hintIconClassName)}
                    aria-hidden="true"
                  />
                </div>
                <span data-testid={card.valueTestId} className="text-2xl font-black text-foreground">
                  {statValues[card.id]}
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick Access: Recent Diary & Wishlist */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Diary */}
        <div className="bg-card p-5 sm:p-6 rounded-3xl border border-border shadow-flat space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <BookOpen className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Ultime Visite nel Diario
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Le tue recensioni più recenti
                </p>
              </div>
            </div>
            <Link
              href="/diary"
              className="text-xs font-black uppercase tracking-wider text-primary hover:underline inline-flex items-center gap-1"
            >
              Vedi tutto <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {recentDiary.length === 0 ? (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border text-center space-y-2.5">
              <p className="text-xs text-muted-foreground font-medium">
                Nessuna visita registrata ancora nel tuo Diario locale.
              </p>
              <Link
                href="/diary?action=new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider shadow-flat flat-press"
              >
                <Star className="size-3.5" /> Aggiungi Primo Kebab
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentDiary.map((entry) => (
                <div
                  key={entry.place_id}
                  className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-foreground truncate">{entry.shop_label}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold truncate">
                      {[entry.city, entry.country].filter(Boolean).join(", ") || "Locale personale"} ·{" "}
                      {formatShortDate(entry.visited_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs font-black">
                      <Star className="size-3 fill-current" />
                      {entry.score_overall.toFixed(1)}
                    </span>
                    <a
                      href={buildMapsUrl(entry.shop_label, entry.place_id, entry.latitude, entry.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Apri ${entry.shop_label} in Google Maps`}
                      className="size-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary flat-press"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Wishlist */}
        <div className="bg-card p-5 sm:p-6 rounded-3xl border border-border shadow-flat space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/25">
                <Bookmark className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Salvati in Wishlist
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Locali pronti da provare
                </p>
              </div>
            </div>
            <Link
              href="/wishlist"
              className="text-xs font-black uppercase tracking-wider text-primary hover:underline inline-flex items-center gap-1"
            >
              Apri lista <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {recentWishlist.length === 0 ? (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border text-center space-y-2.5">
              <p className="text-xs text-muted-foreground font-medium">
                La tua Wishlist locale è vuota. Salva un locale dalla mappa o manualmente.
              </p>
              <Link
                href="/wishlist"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-black uppercase tracking-wider flat-press"
              >
                <Bookmark className="size-3.5 text-primary" /> Gestisci Wishlist
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentWishlist.map((item) => (
                <div
                  key={item.place_id}
                  className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-foreground truncate">{item.shop_label}</p>
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {item.note ? item.note : `Aggiunto il ${formatShortDate(item.added_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/wishlist"
                      className="px-3 py-1.5 min-h-[36px] inline-flex items-center rounded-xl bg-card border border-border text-[11px] font-black uppercase tracking-wider text-foreground hover:border-primary/40 flat-press"
                    >
                      Apri
                    </Link>
                    <a
                      href={buildMapsUrl(item.shop_label, item.place_id, item.latitude, item.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Apri ${item.shop_label} in Google Maps`}
                      className="size-8 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary flat-press"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {activeModalConfig && (
        <InfoDialog
          isOpen={activeModal !== null}
          onClose={closeModal}
          title={activeModalConfig.title}
          subtitle={activeModalConfig.subtitle}
          badgeLabel={activeModalConfig.badgeLabel}
          accent={activeModalConfig.accent}
          icon={activeModalConfig.icon}
          valueLabel={activeModalConfig.valueLabel}
          items={activeModalConfig.items}
          footerNote={activeModalConfig.footerNote}
          restoreFocusTo={lastTriggerRef}
        />
      )}
    </div>
  );
}
