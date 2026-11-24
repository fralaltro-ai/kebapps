"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Bookmark, Star } from "lucide-react";

export type PersonalPinStatus = "unvisited" | "wishlist" | "visited";

interface DynamicShopPinProps {
  status?: PersonalPinStatus;
  personalRating?: number | null;
  inWishlist?: boolean;
  isSelected?: boolean;
}

export function DynamicShopPin({
  status = "unvisited",
  personalRating = null,
  inWishlist = false,
  isSelected = false,
}: DynamicShopPinProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const markerSrc =
    mounted && resolvedTheme === "dark" ? "/icons/kebab-marker-dark.svg" : "/icons/kebab-marker.svg";

  const scale = isSelected
    ? "1.18"
    : status === "visited"
      ? "1.1"
      : status === "wishlist"
        ? "1.05"
        : "1";

  const ringClass =
    status === "visited"
      ? "ring-2 ring-emerald-500 bg-emerald-500/15"
      : status === "wishlist"
        ? "ring-2 ring-amber-500 bg-amber-500/15"
        : "";

  const statusLabel =
    status === "visited"
      ? "Locale visitato nel diario"
      : status === "wishlist"
        ? "Locale salvato in wishlist"
        : "Locale non ancora visitato";

  return (
    <div
      className="relative group cursor-pointer transition-transform duration-200 flat-press pointer-events-auto select-none font-quicksand"
      style={{ transform: `scale(${scale})` }}
      role="button"
      tabIndex={0}
      aria-label={statusLabel}
      data-pin-status={status}
    >
      {status === "visited" && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white border border-card shadow-flat text-[10px] font-black leading-none whitespace-nowrap">
          <Star className="size-2.5 fill-current shrink-0" />
          <span>
            {typeof personalRating === "number" && Number.isFinite(personalRating)
              ? personalRating.toFixed(1)
              : "OK"}
          </span>
          {inWishlist && <Bookmark className="size-2.5 fill-current ml-0.5 shrink-0" />}
        </div>
      )}

      {status === "wishlist" && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center justify-center size-5 rounded-full bg-amber-500 text-white border border-card shadow-flat">
          <Bookmark className="size-2.5 fill-current" />
        </div>
      )}

      <div className={`relative z-10 rounded-full transition-all ${ringClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={markerSrc}
          alt={statusLabel}
          width={48}
          height={48}
          className="pointer-events-none drop-shadow-md select-none w-12 h-12"
        />
      </div>
    </div>
  );
}
