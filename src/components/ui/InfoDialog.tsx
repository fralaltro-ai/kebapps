"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type InfoAccentTheme = "primary" | "amber" | "blue" | "emerald" | "purple";

export interface SectionInfoItem {
  label: string;
  description: string;
  accent?: InfoAccentTheme;
}

export interface InfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  icon?: React.ReactNode;
  valueLabel?: string;
  items: SectionInfoItem[];
  footerNote?: string;
  accent?: InfoAccentTheme;
  restoreFocusTo?: React.RefObject<HTMLElement | null>;
}

const ACCENT_STYLES: Record<
  InfoAccentTheme,
  {
    cardBorder: string;
    badge: string;
    iconBox: string;
    valuePill: string;
    itemBox: string;
    itemLabel: string;
  }
> = {
  primary: {
    cardBorder: "border-primary/35",
    badge: "bg-primary/10 text-primary border-primary/25",
    iconBox: "bg-primary/10 text-primary border-primary/25",
    valuePill: "bg-primary/10 text-primary border-primary/25",
    itemBox: "bg-primary/5 border-primary/20",
    itemLabel: "text-primary",
  },
  amber: {
    cardBorder: "border-amber-500/40 dark:border-amber-500/35",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
    iconBox: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    valuePill: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
    itemBox: "bg-amber-500/5 border-amber-500/20",
    itemLabel: "text-amber-700 dark:text-amber-300",
  },
  blue: {
    cardBorder: "border-blue-500/40 dark:border-blue-500/35",
    badge: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30",
    iconBox: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    valuePill: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30",
    itemBox: "bg-blue-500/5 border-blue-500/20",
    itemLabel: "text-blue-700 dark:text-blue-300",
  },
  emerald: {
    cardBorder: "border-emerald-500/40 dark:border-emerald-500/35",
    badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    iconBox: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    valuePill: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    itemBox: "bg-emerald-500/5 border-emerald-500/20",
    itemLabel: "text-emerald-700 dark:text-emerald-300",
  },
  purple: {
    cardBorder: "border-purple-500/40 dark:border-purple-500/35",
    badge: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30",
    iconBox: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    valuePill: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30",
    itemBox: "bg-purple-500/5 border-purple-500/20",
    itemLabel: "text-purple-700 dark:text-purple-300",
  },
};

export function InfoDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  badgeLabel = "Guida Rapida",
  icon,
  valueLabel,
  items,
  footerNote,
  accent = "primary",
  restoreFocusTo,
}: InfoDialogProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
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

    const focusTarget = restoreFocusTo?.current ?? null;
    const raf = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      focusTarget?.focus();
    };
  }, [isOpen, restoreFocusTo]);

  if (!isOpen || !mounted) return null;

  const themeStyles = ACCENT_STYLES[accent];

  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 font-quicksand animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="fixed inset-0 bg-neutral-950/65 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={cardRef}
        className={cn(
          "relative z-10 w-full sm:max-w-md bg-card text-foreground rounded-t-3xl sm:rounded-3xl border shadow-dropdown p-5 pb-[calc(1.25rem+var(--safe-b,0px))] sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-150",
          themeStyles.cardBorder
        )}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          aria-label="Chiudi informazioni"
          className="absolute top-4 right-4 size-9 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border flex items-center justify-center transition-colors flat-press"
        >
          <X className="size-4" />
        </button>

        <div className="pr-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest",
                themeStyles.badge
              )}
            >
              <CircleHelp className="size-3.5" />
              <span>{badgeLabel}</span>
            </span>
            {valueLabel && (
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-xl border text-[11px] font-black",
                  themeStyles.valuePill
                )}
              >
                {valueLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {icon && (
              <div
                className={cn(
                  "size-10 rounded-xl border flex items-center justify-center shrink-0",
                  themeStyles.iconBox
                )}
              >
                {icon}
              </div>
            )}
            <h2 id={titleId} className="text-lg font-black tracking-tight text-foreground">
              {title}
            </h2>
          </div>

          {subtitle && (
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const itemTheme = ACCENT_STYLES[item.accent ?? accent];
            return (
              <div
                key={item.label}
                className={cn("p-3 rounded-2xl border space-y-1", itemTheme.itemBox)}
              >
                <div
                  className={cn(
                    "text-xs font-black uppercase tracking-wider",
                    itemTheme.itemLabel
                  )}
                >
                  {item.label}
                </div>
                <p className="text-xs font-medium text-foreground/90 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {footerNote && (
          <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed pt-1 border-t border-border">
            {footerNote}
          </p>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
