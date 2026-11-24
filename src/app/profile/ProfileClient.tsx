"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  ChevronRight,
  HardDrive,
  HelpCircle,
  Settings,
  SlidersHorizontal,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { notifyLocalDataChanged } from "@/components/diary/DiaryEntryModal";
import { SectionInfoButton } from "@/components/ui/SectionInfoButton";
import { useToast } from "@/context/ToastContext";
import { useGpsConsent } from "@/hooks/useGpsConsent";
import { useMapConsent } from "@/hooks/useMapConsent";
import { INTERNAL_AVATARS, getAvatarSrc } from "@/lib/avatars";
import { computePersonalGamification } from "@/lib/gamification";
import { triggerHaptic } from "@/lib/haptics";
import {
  estimateLocalStorageUsage,
  formatBytes,
  type LocalStorageUsageEstimate,
} from "@/lib/local-storage/backup";
import {
  getLocalProfile,
  listDiaryEntries,
  saveLocalProfile,
} from "@/lib/local-storage/db";
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_NICKNAME,
  MAX_NICKNAME_LENGTH,
  type AvatarId,
  type DiaryEntry,
  type LocalProfile,
} from "@/lib/local-storage/schema";
import { cn } from "@/lib/utils";

const THEME_LABELS: Record<string, string> = {
  light: "Chiaro",
  dark: "Scuro",
  system: "Sistema",
};

function ProfileContent() {
  const { theme } = useTheme();
  const { success: toastSuccess, error: toastError } = useToast();
  const { status: mapStatus } = useMapConsent();
  const { status: gpsStatus } = useGpsConsent();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [nicknameInput, setNicknameInput] = useState(DEFAULT_NICKNAME);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [storageEstimate, setStorageEstimate] = useState<LocalStorageUsageEstimate | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isDirtyNicknameRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadAll = useCallback(async () => {
    const [loadedProfile, loadedDiary, usage] = await Promise.all([
      getLocalProfile(),
      listDiaryEntries(),
      estimateLocalStorageUsage(),
    ]);
    setProfile(loadedProfile);
    if (!isDirtyNicknameRef.current) {
      setNicknameInput(loadedProfile.nickname);
    }
    setDiary(loadedDiary);
    setStorageEstimate(usage);
  }, []);

  useEffect(() => {
    void loadAll();
    const handleSync = () => {
      void loadAll();
    };
    window.addEventListener("kebapps:local-data-changed", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("kebapps:local-data-changed", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, [loadAll]);

  const stats = computePersonalGamification(diary);
  const activeAvatarId = profile?.avatar_id ?? DEFAULT_AVATAR_ID;

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nicknameInput.trim();
    if (!trimmed || isSavingProfile) return;

    setIsSavingProfile(true);
    try {
      const updated = await saveLocalProfile({
        nickname: trimmed.slice(0, MAX_NICKNAME_LENGTH),
      });
      isDirtyNicknameRef.current = false;
      setProfile(updated);
      setNicknameInput(updated.nickname);
      notifyLocalDataChanged();
      await loadAll();
      toastSuccess("Nickname aggiornato!");
    } catch {
      toastError("Impossibile salvare il nickname.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSelectAvatar = async (avatarId: AvatarId) => {
    triggerHaptic("light");
    try {
      const updated = await saveLocalProfile({ avatar_id: avatarId });
      setProfile(updated);
      notifyLocalDataChanged();
      await loadAll();
      toastSuccess("Avatar aggiornato!");
    } catch {
      toastError("Impossibile aggiornare l'avatar.");
    }
  };

  const activeThemeLabel = mounted ? (THEME_LABELS[theme ?? "system"] ?? "Sistema") : "Sistema";
  const preferencesSummary = `Tema: ${activeThemeLabel} · Maps ${
    mapStatus === "granted" ? "attivo" : "disattivato"
  } · GPS ${gpsStatus === "granted" ? "attivo" : "disattivato"}`;
  const dataSummary = storageEstimate
    ? `Spazio stimato: ${formatBytes(storageEstimate.totalBytes)} · Export & Import JSON`
    : "Spazio IndexedDB, Export/Import JSON e Reset";

  const settingsLinks = [
    {
      href: "/profile/preferences",
      testId: "profile-nav-preferences",
      title: "Tema & Consensi Dispositivo",
      subtitle: preferencesSummary,
      icon: SlidersHorizontal,
    },
    {
      href: "/profile/data",
      testId: "profile-nav-data",
      title: "Dati, Backup & Reset",
      subtitle: dataSummary,
      icon: HardDrive,
    },
    {
      href: "/profile/info",
      testId: "profile-nav-info",
      title: "Supporto, Info & Documenti",
      subtitle: "Contatto assistenza e informative legali (Privacy, Cookie, Termini)",
      icon: HelpCircle,
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header Identità & Stato Rapido */}
      <section className="bg-card p-6 rounded-3xl border border-border shadow-flat flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="size-16 rounded-2xl bg-primary/10 border border-primary/25 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAvatarSrc(activeAvatarId)}
              alt={profile?.nickname || DEFAULT_NICKNAME}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary block">
              Profilo Locale
            </span>
            <h1
              data-testid="profile-heading-nickname"
              className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate"
            >
              {profile?.nickname || DEFAULT_NICKNAME}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              {stats.level.current.level} · {stats.xp.totalXp} XP
            </p>
          </div>
        </div>

        <a
          href="#identita-locale"
          onClick={() => triggerHaptic("light")}
          className="min-h-[40px] px-4 py-2 rounded-2xl bg-muted/60 hover:bg-primary/10 border border-border hover:border-primary/30 text-xs font-black uppercase tracking-wider text-foreground hover:text-primary flat-press inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <UserIcon className="size-3.5 text-primary" />
          Personalizza
        </a>
      </section>

      {/* Identità Locale: Nickname & 5 Avatar SVG */}
      <section
        id="identita-locale"
        className="bg-card p-6 rounded-3xl border border-border shadow-flat space-y-5"
      >
        <div className="flex items-center gap-2.5">
          <UserIcon className="size-5 text-primary" />
          <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
            Identità Locale
          </h2>
        </div>

        <form onSubmit={(e) => void handleSaveNickname(e)} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            data-testid="profile-nickname-input"
            maxLength={MAX_NICKNAME_LENGTH}
            required
            value={nicknameInput}
            onChange={(e) => {
              isDirtyNicknameRef.current = true;
              setNicknameInput(e.target.value);
            }}
            aria-label="Nickname locale"
            placeholder="Il tuo nickname locale"
            className="flex-1 min-h-[44px] rounded-2xl bg-muted/40 border border-border px-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            data-testid="save-nickname-btn"
            disabled={isSavingProfile}
            className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest shadow-flat flat-press inline-flex items-center justify-center gap-1.5"
          >
            <Check className="size-4" /> Salva Nickname
          </button>
        </form>

        <div className="space-y-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
            Scegli Avatar SVG Predefinito
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {INTERNAL_AVATARS.map((avatar) => {
              const selected = activeAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  data-testid={`avatar-option-${avatar.id}`}
                  aria-pressed={selected}
                  onClick={() => void handleSelectAvatar(avatar.id as AvatarId)}
                  className={cn(
                    "p-3 rounded-2xl border flex flex-col items-center gap-2 text-center transition-all flat-press",
                    selected
                      ? "border-primary bg-primary/10 shadow-flat"
                      : "border-border bg-muted/40 hover:border-primary/40"
                  )}
                >
                  <div className="size-12 rounded-xl bg-card border border-border p-1 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar.src} alt={avatar.label} className="w-full h-full object-contain" />
                  </div>
                  <span className="text-[11px] font-black leading-tight text-foreground">
                    {avatar.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Progressione & Badge */}
      <section className="bg-card p-6 rounded-3xl border border-border shadow-flat space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
              Progressione &amp; Badge
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs font-black">
              {stats.xp.totalXp} XP Totali
            </span>
            <SectionInfoButton
              title="Progressione XP & Badge"
              subtitle="Regole di calcolo XP, ranghi e sblocco dei badge locali."
              buttonSize="sm"
              items={[
                {
                  label: "Calcolo XP",
                  description:
                    "+10 XP per ogni locale unico nel Diario, +15 XP per ogni città unica esplorata, +25 XP per ogni nazione unica (5 ranghi da Pivello dello Spiedo a Maestro dello Spiedo).",
                },
                {
                  label: "Soglie Badge",
                  description:
                    "Pioniere: 1 locale visitato; Esploratore: 5 città distinte; Gourmet: 15 città distinte; Globetrotter: 3 nazioni diverse.",
                },
              ]}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-foreground uppercase">{stats.level.current.level}</p>
              <p className="text-xs font-bold text-primary">{stats.level.current.title}</p>
            </div>
            <span className="text-xs font-black text-muted-foreground">
              {stats.level.next
                ? `Prossimo: ${stats.level.next.level} (-${stats.level.xpToNextLevel} XP)`
                : "Livello massimo raggiunto"}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-card border border-border overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${stats.level.progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {stats.level.current.description} (Visite: +{stats.xp.xpFromVisits} XP · Città: +{stats.xp.xpFromCities} XP · Nazioni: +{stats.xp.xpFromCountries} XP)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.badges.map((badge) => (
            <div
              key={badge.id}
              className={cn(
                "p-3.5 rounded-2xl border flex items-center gap-3",
                badge.unlocked
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-muted/30 border-border opacity-80"
              )}
            >
              <div
                className={cn(
                  "size-10 rounded-xl flex items-center justify-center shrink-0 border",
                  badge.unlocked
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-card text-muted-foreground border-border"
                )}
              >
                <Award className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">
                    {badge.name}
                  </span>
                  <span className="text-[11px] font-black text-primary">{badge.progressText}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sezione Impostazioni */}
      <section
        aria-label="Impostazioni profilo"
        className="bg-card p-6 rounded-3xl border border-border shadow-flat space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <Settings className="size-5 text-primary" />
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
              Impostazioni
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Preferenze del dispositivo, gestione dati JSON e documentazione legale.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {settingsLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                onClick={() => triggerHaptic("light")}
                className="min-h-[60px] flex items-center justify-between gap-3 p-4 rounded-2xl bg-muted/40 hover:bg-primary/10 border border-border hover:border-primary/35 transition-colors group flat-press"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="size-10 rounded-xl bg-card border border-border text-primary flex items-center justify-center shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function ProfileClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background">
          <div className="w-16 h-1 bg-muted overflow-hidden rounded-full" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
