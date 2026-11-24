"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp, Bug } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log unexpected errors for client monitoring
    console.error("[KebApps Global Error Boundary]:", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 animate-in fade-in duration-500 font-quicksand">
      <div className="max-w-md w-full bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-flat text-center space-y-6">
        {/* Animated Icon Badge */}
        <div className="size-16 sm:size-20 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
          <AlertTriangle className="size-8 sm:size-10 animate-bounce duration-1000" />
        </div>

        {/* Catchy Content */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
            Intoppo sulla Griglia 🥙
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Ops! Lo spiedo si è inceppato...
          </h1>
          <p className="text-sm text-muted-foreground font-medium max-w-sm mx-auto">
            Si è verificato un errore imprevisto durante il caricamento. Nessun dato è andato perduto, ma dobbiamo rimettere in sesto la griglia.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl shadow-flat transition-all flat-press hover:bg-primary/90"
          >
            <RotateCcw className="size-4" />
            Riprova subito
          </button>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground hover:bg-muted/80 font-bold text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl border border-border transition-all flat-press"
          >
            <Home className="size-4 text-muted-foreground" />
            Home
          </Link>
        </div>

        {/* Optional Technical Details for Troubleshooting */}
        <div className="pt-2 border-t border-border/60">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bug className="size-3" />
            {showDetails ? "Nascondi dettagli tecnici" : "Dettagli tecnici per l'assistenza"}
            {showDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {showDetails && (
            <div className="mt-3 p-3 bg-muted/60 rounded-xl text-left border border-border/60 space-y-1 font-mono text-[10px] text-muted-foreground break-all">
              {error.digest && (
                <p>
                  <strong className="text-foreground font-sans">Codice Errore (Digest):</strong> {error.digest}
                </p>
              )}
              {error.message && (
                <p>
                  <strong className="text-foreground font-sans">Messaggio:</strong> {error.message}
                </p>
              )}
              {!error.digest && !error.message && (
                <p>Nessun codice diagnostico disponibile.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
