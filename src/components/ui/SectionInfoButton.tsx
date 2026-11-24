"use client";

import React, { useCallback, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { InfoDialog, type InfoAccentTheme, type SectionInfoItem } from "./InfoDialog";
import { triggerHaptic } from "@/lib/haptics";

export type { SectionInfoItem };

export interface SectionInfoButtonProps {
  title: string;
  subtitle?: string;
  items: SectionInfoItem[];
  footerNote?: string;
  ariaLabel?: string;
  className?: string;
  buttonSize?: "sm" | "md";
  testId?: string;
  accent?: InfoAccentTheme;
  badgeLabel?: string;
}

export function SectionInfoButton({
  title,
  subtitle,
  items,
  footerNote,
  ariaLabel,
  className = "",
  buttonSize = "md",
  testId,
  accent = "primary",
  badgeLabel = "Guida Rapida",
}: SectionInfoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    triggerHaptic("light");
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const sizeClasses = buttonSize === "sm" ? "size-8 sm:size-8" : "size-9 sm:size-9";
  const iconClasses = buttonSize === "sm" ? "size-3.5" : "size-4";

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={handleOpen}
        aria-label={ariaLabel ?? `Informazioni su ${title}`}
        data-testid={testId}
        className={`inline-flex items-center justify-center rounded-full bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors flat-press shrink-0 ${sizeClasses} ${className}`}
      >
        <CircleHelp className={iconClasses} />
      </button>
      <InfoDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={title}
        subtitle={subtitle}
        badgeLabel={badgeLabel}
        items={items}
        footerNote={footerNote}
        accent={accent}
        restoreFocusTo={triggerButtonRef}
      />
    </>
  );
}
