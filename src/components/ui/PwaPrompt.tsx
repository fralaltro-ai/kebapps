"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare, Check, MoreVertical, ExternalLink, Globe } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  isStandalone,
  hasSeenOnboarding,
  registerSession,
  isPwaSnoozed,
  snoozePwaPrompt,
  getPlatformInfo,
  getDeferredPrompt,
  clearDeferredPrompt,
  type BeforeInstallPromptEvent,
  type PlatformInfo,
  PWA_MIN_SESSIONS,
} from "@/lib/pwa-utils";

const SHOW_DELAY_MS = 6000;
const EXCLUDED_PATHS: string[] = ["/privacy-policy", "/cookie-policy", "/terms", "/~offline"];

const IN_APP_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  telegram: "Telegram",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
};

export default function PwaPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidManualFallback, setShowAndroidManualFallback] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Structural exclusivity guard: never show while onboarding hasn't run yet,
    // while already installed/TWA, on excluded routes, in the first session,
    // or during an active 7-day snooze window.
    if (isStandalone()) return;
    if (!hasSeenOnboarding()) return;
    if (EXCLUDED_PATHS.includes(pathname)) return;
    if (isPwaSnoozed()) return;

    const sessionCount = registerSession();
    if (sessionCount < PWA_MIN_SESSIONS) return;

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reveal = () => {
      if (!isMounted) return;
      const existing = getDeferredPrompt();
      if (existing) setDeferredPrompt(existing);
      setPlatformInfo(getPlatformInfo());
      setShowPrompt(true);
    };

    const handleInstallReady = () => {
      const p = getDeferredPrompt();
      if (p && isMounted) setDeferredPrompt(p);
      reveal();
    };
    const handleInstalled = () => {
      if (isMounted) setShowPrompt(false);
    };

    const run = () => {
      if (!isMounted) return;

      window.addEventListener("kebapp:installready", handleInstallReady);
      window.addEventListener("kebapp:installed", handleInstalled);

      // beforeinstallprompt may have already fired before this effect ran
      // (captured by the beforeInteractive bootstrap script in layout.tsx).
      const existing = getDeferredPrompt();
      if (existing) {
        setDeferredPrompt(existing);
        setPlatformInfo(getPlatformInfo());
      }

      timer = setTimeout(reveal, SHOW_DELAY_MS);
    };

    run();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("kebapp:installready", handleInstallReady);
      window.removeEventListener("kebapp:installed", handleInstalled);
    };
  }, [pathname]);

  const dismiss = () => {
    snoozePwaPrompt();
    setShowPrompt(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowAndroidManualFallback(true);
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      clearDeferredPrompt();
      setDeferredPrompt(null);
      if (outcome === "accepted") {
        setShowPrompt(false);
      } else {
        setShowAndroidManualFallback(true);
      }
    } catch {
      setShowAndroidManualFallback(true);
    }
  };

  if (isStandalone() || !showPrompt || !platformInfo) return null;

  const { platform, inApp } = platformInfo;
  const inAppLabel = inApp ? IN_APP_LABELS[inApp] : null;
  const isAndroidNative = platform === "android-chrome" && !!deferredPrompt && !showAndroidManualFallback && !inApp;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9998] px-3 flex justify-center animate-in slide-in-from-bottom-6 fade-in duration-500"
      style={{ marginBottom: "calc(var(--dock-space, 5rem) + 0.5rem)" }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-prompt-title"
    >
      <div className="w-full max-w-md max-h-[calc(100dvh-var(--dock-space,5rem)-1.5rem)] overflow-y-auto app-scroll overscroll-contain bg-card p-5 rounded-3xl border-2 border-border shadow-dropdown relative font-quicksand">
        <button
          onClick={dismiss}
          aria-label="Chiudi suggerimento installazione"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground bg-muted p-1.5 rounded-full flat-press"
        >
          <X className="w-4 h-4" />
        </button>

        {inApp !== null ? (
          <InAppContent appLabel={inAppLabel ?? "questa app"} />
        ) : isAndroidNative ? (
          <AndroidNativeContent onInstall={handleInstallClick} />
        ) : platform === "android-chrome" ? (
          <AndroidManualContent onDismiss={dismiss} />
        ) : platform === "ios-safari" ? (
          <IosSafariContent onDismiss={dismiss} />
        ) : platform === "android-other" ? (
          <AndroidOtherContent onDismiss={dismiss} />
        ) : (
          <GenericContent onDismiss={dismiss} />
        )}
      </div>
    </div>
  );
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-primary/10 p-4 rounded-2xl mb-4 border border-primary/20 w-fit mx-auto">
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h3 id="pwa-prompt-title" className="font-quicksand font-bold text-foreground text-lg leading-tight mb-2 text-center">
      {children}
    </h3>
  );
}

function AndroidNativeContent({ onInstall }: { onInstall: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <IconWrap>
        <Download className="w-8 h-8 text-primary" />
      </IconWrap>
      <Title>Installa KebApps</Title>
      <p className="text-sm font-medium text-muted-foreground mb-5 px-1">
        Aggiungi l&apos;app alla Home per un&apos;esperienza più veloce e nativa.
      </p>
      <button
        onClick={onInstall}
        className="w-full bg-primary text-primary-foreground font-quicksand font-bold text-sm py-3.5 rounded-xl shadow-flat hover:bg-primary/90 active:translate-y-0.5 active:shadow-none transition-all flat-press"
      >
        Installa Ora
      </button>
    </div>
  );
}

function AndroidManualContent({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <IconWrap>
        <MoreVertical className="w-8 h-8 text-primary" />
      </IconWrap>
      <Title>Installa KebApps</Title>
      <p className="text-sm font-medium text-muted-foreground mb-5 px-1">
        Tocca i tre puntini <MoreVertical className="inline w-4 h-4 text-foreground -mt-1 mx-0.5" /> in alto a destra e scegli <strong>&quot;Installa app&quot;</strong>.
      </p>
      <button
        onClick={onDismiss}
        className="w-full bg-primary text-primary-foreground font-quicksand font-bold text-sm py-3.5 rounded-xl shadow-flat hover:bg-primary/90 active:translate-y-0.5 active:shadow-none transition-all flat-press"
      >
        Ho Capito
      </button>
    </div>
  );
}

function IosSafariContent({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    { icon: Share, text: "Tocca l'icona Condividi qui in basso." },
    { icon: PlusSquare, text: <>Scorri e seleziona <strong>&quot;Aggiungi alla schermata Home&quot;</strong>.</> },
    { icon: Check, text: <>Tocca <strong>&quot;Aggiungi&quot;</strong> in alto a destra.</> },
  ];
  return (
    <div className="flex flex-col items-center text-center">
      <IconWrap>
        <Share className="w-8 h-8 text-primary" />
      </IconWrap>
      <Title>Installa su iPhone</Title>
      <div className="w-full space-y-2.5 mb-5">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={idx} className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl border border-border text-left">
              <div className="bg-primary text-primary-foreground rounded-full size-6 flex items-center justify-center text-xs font-black shrink-0">
                {idx + 1}
              </div>
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs font-medium text-foreground leading-tight">{step.text}</p>
            </div>
          );
        })}
      </div>
      <button
        onClick={onDismiss}
        className="w-full bg-primary text-primary-foreground font-quicksand font-bold text-sm py-3.5 rounded-xl shadow-flat hover:bg-primary/90 active:translate-y-0.5 active:shadow-none transition-all flat-press"
      >
        Ho Capito
      </button>
    </div>
  );
}

function InAppContent({ appLabel }: { appLabel: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <IconWrap>
        <ExternalLink className="w-8 h-8 text-primary" />
      </IconWrap>
      <Title>Apri nel Browser</Title>
      <p className="text-sm font-medium text-muted-foreground px-1">
        Stai usando KebApps dentro {appLabel}. Apri il link in <strong>Safari</strong> o <strong>Chrome</strong> per installare l&apos;app.
      </p>
    </div>
  );
}

function AndroidOtherContent({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <IconWrap>
        <Globe className="w-8 h-8 text-primary" />
      </IconWrap>
      <Title>Usa Google Chrome</Title>
      <p className="text-sm font-medium text-muted-foreground mb-5 px-1">
        Stai usando un browser non ottimizzato. Apri KebApps.app su Chrome per installare l&apos;app in modo perfetto.
      </p>
      <button
        onClick={onDismiss}
        className="w-full bg-primary text-primary-foreground font-quicksand font-bold text-sm py-3.5 rounded-xl shadow-flat hover:bg-primary/90 active:translate-y-0.5 active:shadow-none transition-all flat-press"
      >
        Ho Capito
      </button>
    </div>
  );
}

function GenericContent({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <IconWrap>
        <Download className="w-8 h-8 text-primary" />
      </IconWrap>
      <Title>Installa KebApps</Title>
      <p className="text-sm font-medium text-muted-foreground mb-5 px-1">
        Cerca l&apos;icona di installazione nella barra degli indirizzi del tuo browser per aggiungere KebApps al dispositivo.
      </p>
      <button
        onClick={onDismiss}
        className="w-full bg-primary text-primary-foreground font-quicksand font-bold text-sm py-3.5 rounded-xl shadow-flat hover:bg-primary/90 active:translate-y-0.5 active:shadow-none transition-all flat-press"
      >
        Ho Capito
      </button>
    </div>
  );
}
