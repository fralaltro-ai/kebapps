"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  X,
} from "lucide-react";
import { useTurnstile } from "@/hooks/useTurnstile";

const CLOUDFLARE_VISIBLE_PASS_SITE_KEY = "1x00000000000000000000AA";
const DEFAULT_SUPPORT_SUBJECT = "[KebApps] Supporto / Segnalazione";

type GateStatus =
  | "idle"
  | "offline"
  | "verifying"
  | "loading_contact"
  | "unlocked"
  | "error";

interface SupportEmailGateProps {
  variant?: "card" | "inline";
  triggerLabel?: string;
  subject?: string;
}

interface TurnstileChallengeBoxProps {
  siteKey: string;
  theme: "auto" | "light" | "dark";
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: (message: string) => void;
}

/**
 * Isolated widget container mounted strictly on demand once the user requests
 * to unlock the support email, ensuring challenges.cloudflare.com is never
 * loaded on normal page visits.
 */
function TurnstileChallengeBox({
  siteKey,
  theme,
  onVerify,
  onExpire,
  onError,
}: TurnstileChallengeBoxProps) {
  const { containerRef } = useTurnstile({
    action: "support_contact",
    siteKey,
    size: "flexible",
    theme,
    execution: "render",
    appearance: "always",
    timeoutMs: 12000,
    onVerify,
    onExpire,
    onError,
  });

  return (
    <div
      ref={containerRef}
      data-testid="support-turnstile-widget"
      className="min-h-[66px] w-full flex items-center justify-center rounded-xl bg-card border border-border px-2 py-2 overflow-hidden"
    />
  );
}

/**
 * On-demand Cloudflare Turnstile gate that protects the support email address
 * from automated scraping without storing anything persistently or loading
 * third-party scripts prior to explicit user action.
 */
export function SupportEmailGate({
  variant = "card",
  triggerLabel,
  subject = DEFAULT_SUPPORT_SUBJECT,
}: SupportEmailGateProps) {
  const { resolvedTheme } = useTheme();
  const widgetTheme: "auto" | "light" | "dark" =
    resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : "auto";

  const supportSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SUPPORT_SITE_KEY || "").trim();
  const isProd = process.env.NODE_ENV === "production";

  const [status, setStatus] = useState<GateStatus>("idle");
  const [unlockedEmail, setUnlockedEmail] = useState<string | null>(null);
  const [effectiveSubject, setEffectiveSubject] = useState<string>(subject);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const mountedRef = useRef(true);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const handleOnline = () => {
      if (mountedRef.current) setIsOffline(false);
    };
    const handleOffline = () => {
      if (mountedRef.current) setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const fetchSupportEmail = useCallback(
    async (turnstileToken: string) => {
      if (!mountedRef.current) return;
      setStatus("loading_contact");
      setErrorMessage(null);
      setStatusNotice(null);

      try {
        const res = await fetch("/api/support-contact", {
          method: "GET",
          headers: {
            "x-turnstile-token": turnstileToken,
          },
          cache: "no-store",
        });

        const payload = (await res.json().catch(() => null)) as
          | { email?: unknown; subject?: unknown; error?: unknown }
          | null;

        if (!mountedRef.current) return;

        if (!res.ok || !payload || typeof payload.email !== "string" || !payload.email.trim()) {
          const message =
            payload && typeof payload.error === "string"
              ? payload.error
              : "Impossibile verificare e sbloccare l'indirizzo email di supporto.";
          setErrorMessage(message);
          setStatus("error");
          return;
        }

        setUnlockedEmail(payload.email.trim());
        setEffectiveSubject(
          typeof payload.subject === "string" && payload.subject.trim()
            ? payload.subject.trim()
            : subject
        );
        setStatus("unlocked");
      } catch {
        if (!mountedRef.current) return;
        const currentlyOffline = typeof navigator !== "undefined" && !navigator.onLine;
        if (currentlyOffline) {
          setIsOffline(true);
          setStatus("offline");
          return;
        }
        setErrorMessage("Errore di rete durante la verifica. Controlla la connessione e riprova.");
        setStatus("error");
      }
    },
    [subject]
  );

  const startVerification = useCallback(() => {
    const currentlyOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (currentlyOffline || isOffline) {
      setIsOffline(true);
      setErrorMessage(null);
      setStatusNotice(null);
      setStatus("offline");
      return;
    }

    setErrorMessage(null);
    setStatusNotice(null);

    if (!supportSiteKey) {
      if (isProd) {
        setErrorMessage("Verifica anti-bot temporaneamente non configurata.");
        setStatus("error");
        return;
      }
      void fetchSupportEmail("dev-turnstile-bypass");
      return;
    }

    setRetryKey((k) => k + 1);
    setStatus("verifying");
  }, [fetchSupportEmail, isOffline, isProd, supportSiteKey]);

  const handleTurnstileVerify = useCallback(
    (token: string) => {
      void fetchSupportEmail(token);
    },
    [fetchSupportEmail]
  );

  const handleTurnstileExpire = useCallback(() => {
    if (!mountedRef.current) return;
    setStatusNotice("Verifica scaduta, completa nuovamente il controllo.");
  }, []);

  const handleTurnstileError = useCallback(
    (message: string) => {
      if (!mountedRef.current) return;
      const currentlyOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (currentlyOffline) {
        setIsOffline(true);
        setStatus("offline");
        return;
      }

      if (!isProd && supportSiteKey === CLOUDFLARE_VISIBLE_PASS_SITE_KEY) {
        void fetchSupportEmail("dev-turnstile-bypass");
        return;
      }

      setErrorMessage(
        `${message} Se usi un blocco contenuti, consenti temporarily challenges.cloudflare.com e riprova.`
      );
      setStatus("error");
    },
    [fetchSupportEmail, isProd, supportSiteKey]
  );

  const handleReset = useCallback(() => {
    setErrorMessage(null);
    setStatusNotice(null);
    setStatus("idle");
  }, []);

  const handleCopyEmail = useCallback(async () => {
    if (!unlockedEmail || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(unlockedEmail);
      if (!mountedRef.current) return;
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API blocked or unavailable; email remains selectable on screen.
    }
  }, [unlockedEmail]);

  const isInline = variant === "inline";
  const resolvedTriggerLabel =
    triggerLabel || (isInline ? "Mostra email di contatto" : "Scrivi al supporto");

  if (status === "unlocked" && unlockedEmail) {
    const mailtoHref = `mailto:${unlockedEmail}?subject=${encodeURIComponent(effectiveSubject)}`;

    return (
      <div
        data-testid="support-email-unlocked"
        className={`rounded-2xl border border-emerald-500/30 bg-emerald-500/10 font-quicksand ${
          isInline ? "mt-2.5 p-3 space-y-2.5" : "p-3.5 space-y-3"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Verifica completata
            </span>
          </div>
          <span
            data-testid="support-unlocked-email"
            className="text-xs font-black text-foreground select-all truncate"
          >
            {unlockedEmail}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={mailtoHref}
            data-testid="support-mailto-link"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider shadow-flat flat-press inline-flex items-center justify-center gap-1.5"
          >
            <Mail className="size-3.5 shrink-0" />
            <span>Apri client email</span>
          </a>

          <button
            type="button"
            onClick={() => void handleCopyEmail()}
            data-testid="support-copy-email-btn"
            className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground text-xs font-black uppercase tracking-wider flat-press inline-flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Copiato</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 shrink-0" />
                <span>Copia indirizzo</span>
              </>
            )}
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {copied ? "Indirizzo email copiato negli appunti." : ""}
        </span>
      </div>
    );
  }

  if (status === "idle") {
    return (
      <div className={isInline ? "mt-2 space-y-1.5 font-quicksand" : "space-y-2.5 font-quicksand"}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startVerification}
            data-testid="support-unlock-trigger"
            className={
              isInline
                ? "min-h-[44px] sm:min-h-[40px] px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-black uppercase tracking-wider flat-press inline-flex items-center justify-center gap-1.5"
                : "min-h-[44px] px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider shadow-flat flat-press inline-flex items-center justify-center gap-1.5"
            }
          >
            <Mail className="size-3.5 shrink-0" />
            <span>{resolvedTriggerLabel}</span>
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
          Protezione anti-spam: al clic carica il controllo{" "}
          <strong className="text-foreground">Cloudflare Turnstile</strong> (IP e metadati tecnici —{" "}
          <Link href="/privacy-policy" className="text-primary font-bold hover:underline">
            Privacy
          </Link>{" "}
          e{" "}
          <Link href="/cookie-policy" className="text-primary font-bold hover:underline">
            Cookie Policy
          </Link>
          ).
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="support-gate-panel"
      className={`rounded-2xl border border-border bg-card font-quicksand ${
        isInline ? "mt-2.5 p-3 space-y-2.5" : "p-4 space-y-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {status === "offline" ? (
            <WifiOff className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : status === "error" ? (
            <AlertCircle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
          ) : (
            <ShieldCheck className="size-4 text-primary shrink-0" />
          )}
          <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
            {status === "offline"
              ? "Connessione richiesta"
              : status === "error"
                ? "Verifica non riuscita"
                : status === "loading_contact"
                  ? "Sblocco contatto..."
                  : "Verifica anti-spam Cloudflare Turnstile"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleReset}
          aria-label="Chiudi verifica anti-bot"
          data-testid="support-gate-close"
          className="size-11 sm:size-9 rounded-xl bg-muted hover:bg-muted/80 border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center flat-press shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      {status === "offline" && (
        <div data-testid="support-offline-notice" className="space-y-2.5">
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            Sei offline: serve una connessione Internet per verificare la protezione anti-bot e sbloccare l&apos;indirizzo email di supporto.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startVerification}
              data-testid="support-retry-btn"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider flat-press inline-flex items-center gap-1.5"
            >
              <RefreshCw className="size-3.5 shrink-0" />
              <span>Riprova</span>
            </button>
          </div>
        </div>
      )}

      {status === "verifying" && supportSiteKey && (
        <div className="space-y-2">
          <TurnstileChallengeBox
            key={retryKey}
            siteKey={supportSiteKey}
            theme={widgetTheme}
            onVerify={handleTurnstileVerify}
            onExpire={handleTurnstileExpire}
            onError={handleTurnstileError}
          />
          {statusNotice ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold" role="status">
              {statusNotice}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground font-medium">
              Completa il controllo per visualizzare e copiare l&apos;indirizzo email di assistenza.
            </p>
          )}
        </div>
      )}

      {status === "loading_contact" && (
        <div className="flex items-center gap-2 py-2 text-xs font-bold text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary shrink-0" />
          <span>Validazione del token e sblocco contatto in corso...</span>
        </div>
      )}

      {status === "error" && (
        <div data-testid="support-error-notice" className="space-y-2.5">
          <p className="text-xs text-red-700 dark:text-red-300 font-bold leading-relaxed">
            {errorMessage || "Verifica anti-bot non riuscita."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startVerification}
              data-testid="support-retry-btn"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider flat-press inline-flex items-center gap-1.5"
            >
              <RefreshCw className="size-3.5 shrink-0" />
              <span>Riprova</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
