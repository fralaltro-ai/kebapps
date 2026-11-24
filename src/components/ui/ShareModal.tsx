"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Globe, Copy, Check, Share2, type LucideIcon } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { triggerHaptic } from "@/lib/haptics";

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShareChannel {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  url: string | undefined;
}

const SHARE_TITLE = "KebApps";
const SHARE_TEXT = "Scopri i migliori Kebab vicino a te su KebApps! 🥙🔥";

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { success, error } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

  const channels: ShareChannel[] = [
    { id: "web", label: "Sito Web (PWA)", description: "Condividi il link diretto a KebApps", icon: Globe, url: siteUrl },
  ];

  // ESC to close + body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const container = cardRef.current;
        if (!container) return;
        const focusable = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Focus management: focus the close button on open, restore previous focus on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      triggerHaptic("light");
      const raf = requestAnimationFrame(() => closeButtonRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    previousFocusRef.current?.focus();
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setCopiedId(null);
  }, [isOpen]);

  const handleShare = useCallback(
    async (channel: ShareChannel) => {
      if (!channel.url) return;
      triggerHaptic("light");

      const shareData = { title: SHARE_TITLE, text: SHARE_TEXT, url: channel.url };

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share(shareData);
          onClose();
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            // User cancelled the native share sheet: no feedback, keep modal open.
            return;
          }
          // Fall through to clipboard fallback below.
        }
      }

      try {
        await navigator.clipboard.writeText(channel.url);
        setCopiedId(channel.id);
        success("Link copiato negli appunti! 🔥");
        setTimeout(() => setCopiedId((current) => (current === channel.id ? null : current)), 2000);
      } catch {
        error("Impossibile copiare il link");
      }
    },
    [onClose, success, error]
  );

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200 font-quicksand"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-neutral-950/65 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div
        ref={cardRef}
        className="relative w-full sm:max-w-md bg-card text-foreground rounded-t-3xl sm:rounded-3xl border border-border shadow-dropdown p-6 pb-[calc(1.5rem+var(--safe-b))] sm:pb-6 z-10 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-5 right-5 size-9 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flat-press border border-border"
          aria-label="Chiudi condivisione"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6 pr-8 sm:pr-10">
          <div className="size-11 sm:size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0 shadow-inner">
            <Share2 className="size-5 sm:size-6" />
          </div>
          <div>
            <h2 id="share-modal-title" className="text-lg sm:text-xl font-black text-foreground">
              Condividi KebApps
            </h2>
            <p className="text-sm text-muted-foreground">Scegli dove condividere il link</p>
          </div>
        </div>

        {/* Channels */}
        <div className="flex flex-col gap-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            const isDisabled = !channel.url?.trim();
            const isCopied = copiedId === channel.id;

            return (
              <button
                key={channel.id}
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled}
                onClick={() => handleShare(channel)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                  isDisabled
                    ? "opacity-60 cursor-not-allowed bg-muted/40 border-border"
                    : "bg-card border-border hover:border-primary/50 hover:bg-primary/5 flat-press"
                }`}
              >
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate">{channel.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                </div>
                {!isDisabled && (
                  <div className="shrink-0 text-muted-foreground">
                    {isCopied ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
