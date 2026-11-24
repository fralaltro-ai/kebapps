"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Bookmark,
  MapPin,
  RefreshCcw,
  Star,
  User as UserIcon,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAvatarSrc } from "@/lib/avatars";
import { computePersonalGamification } from "@/lib/gamification";
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

function formatShortDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OfflineClient() {
  const [isOnline, setIsOnline] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  const loadLocalArchive = useCallback(async () => {
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
      setIsLoadingLocal(false);
    }
  }, []);

  useEffect(() => {
    void loadLocalArchive();
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [loadLocalArchive]);

  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const stats = computePersonalGamification(diary);
  const nickname = profile?.nickname || DEFAULT_NICKNAME;
  const avatarSrc = getAvatarSrc(profile?.avatar_id ?? DEFAULT_AVATAR_ID);

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-6 space-y-6 animate-in fade-in duration-500 font-quicksand">
      {/* Offline Banner */}
      <section className="bg-card p-6 sm:p-8 rounded-3xl shadow-flat border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 shrink-0">
              <WifiOff className="size-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Sei Offline</h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                Solo la Mappa Google richiede una connessione Internet. Diario, Wishlist e Profilo restano sempre disponibili sul dispositivo.
              </p>
            </div>
          </div>

          <Button
            onClick={handleRetry}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flat-press rounded-2xl shadow-flat font-black uppercase tracking-widest text-xs py-3 px-5 shrink-0"
          >
            <RefreshCcw className="mr-2 size-4" />
            Riprova
          </Button>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2.5 text-xs font-bold text-foreground">
          <MapPin className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            La Mappa interattiva Google Maps non è caricabile offline. Puoi consultare qui sotto tutti i tuoi dati locali.
          </span>
        </div>

        {isOnline && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">
            Connessione ripristinata! Tocca Riprova per tornare online.
          </p>
        )}
      </section>

      {/* Local Profile Snapshot */}
      <section className="bg-card p-5 rounded-3xl border border-border shadow-flat flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl bg-primary/10 border border-primary/25 p-1 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc} alt={nickname} className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary block">
              Profilo Offline
            </span>
            <h2 className="text-base font-black text-foreground">{nickname}</h2>
            <p className="text-xs text-muted-foreground font-semibold">
              {stats.level.current.level} · {stats.xp.totalXp} XP · Kebab Index {stats.kebabIndex}%
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/diary"
            className="px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs font-black uppercase tracking-wider text-foreground hover:text-primary flat-press inline-flex items-center gap-1.5"
          >
            <BookOpen className="size-3.5" /> Diario
          </Link>
          <Link
            href="/wishlist"
            className="px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs font-black uppercase tracking-wider text-foreground hover:text-primary flat-press inline-flex items-center gap-1.5"
          >
            <Bookmark className="size-3.5" /> Wishlist
          </Link>
          <Link
            href="/profile"
            className="px-3.5 py-2 rounded-xl bg-muted/60 border border-border text-xs font-black uppercase tracking-wider text-foreground hover:text-primary flat-press inline-flex items-center gap-1.5"
          >
            <UserIcon className="size-3.5" /> Profilo
          </Link>
        </div>
      </section>

      {/* Local Diary & Wishlist Consultable Offline */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card p-5 rounded-3xl border border-border shadow-flat space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              Diario Salvato ({diary.length})
            </h2>
          </div>

          {isLoadingLocal ? (
            <p className="text-xs text-muted-foreground font-medium">Lettura dati locali...</p>
          ) : diary.length === 0 ? (
            <p className="text-xs text-muted-foreground font-medium">
              Nessuna voce salvata nel Diario.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto app-scroll pr-1">
              {diary.map((entry) => (
                <div
                  key={entry.place_id}
                  className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm text-foreground truncate">
                      {entry.shop_label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-black shrink-0">
                      <Star className="size-3 fill-current" /> {entry.score_overall.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {[entry.city, entry.country].filter(Boolean).join(", ") || "Locale personale"} ·{" "}
                    {formatShortDate(entry.visited_at)}
                  </p>
                  {entry.note && (
                    <p className="text-xs text-foreground/85 font-medium">&ldquo;{entry.note}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-flat space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <Bookmark className="size-4 text-amber-500" />
              Wishlist Salvata ({wishlist.length})
            </h2>
          </div>

          {isLoadingLocal ? (
            <p className="text-xs text-muted-foreground font-medium">Lettura dati locali...</p>
          ) : wishlist.length === 0 ? (
            <p className="text-xs text-muted-foreground font-medium">
              Nessun locale salvato in Wishlist.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto app-scroll pr-1">
              {wishlist.map((item) => (
                <div
                  key={item.place_id}
                  className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1"
                >
                  <p className="font-black text-sm text-foreground truncate">{item.shop_label}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Aggiunto il {formatShortDate(item.added_at)}
                  </p>
                  {item.note && (
                    <p className="text-xs text-foreground/85 font-medium">{item.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
