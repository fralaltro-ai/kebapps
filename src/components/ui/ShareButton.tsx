"use client";

import React, { useState } from "react";
import { Share2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { ShareModal } from "./ShareModal";

export default function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    triggerHaptic("light");
    setIsOpen(true);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="bg-card border border-border hover:border-primary/50 hover:bg-primary/10 text-foreground size-9 md:h-9 md:w-auto md:px-3.5 rounded-xl transition-all flex items-center justify-center md:gap-2 flat-press shadow-sm"
        title="Condividi KebApps"
        aria-label="Condividi KebApps"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Share2 className="size-4 text-primary transition-transform" />
        <span className="hidden md:inline-block whitespace-nowrap text-xs font-black uppercase tracking-tight">
          Condividi
        </span>
      </button>
      <ShareModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
