"use client";

import { useEffect, useState } from "react";
import { Quicksand } from "next/font/google";
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp, Bug } from "lucide-react";
import "./globals.css";

const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-sans" });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("[KebApps Critical Global Error]:", error);
  }, [error]);

  return (
    <html lang="it" className={quicksand.variable}>
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 font-quicksand antialiased selection:bg-primary/20">
        <main className="max-w-md w-full bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-flat text-center space-y-6">
          {/* Badge Icon */}
          <div className="size-16 sm:size-20 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <AlertTriangle className="size-8 sm:size-10 animate-bounce duration-1000" />
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-destructive/10 text-destructive border border-destructive/20">
              Errore Critico del Sistema 🥙
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              La griglia si è spenta del tutto!
            </h1>
            <p className="text-sm text-muted-foreground font-medium max-w-sm mx-auto">
              Si è verificato un errore critico a livello radice dell&apos;applicazione. Prova a ricaricare o riparti dalla Home.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl shadow-flat transition-all flat-press hover:bg-primary/90"
            >
              <RotateCcw className="size-4" />
              Riavvia Griglia
            </button>
            <button
              onClick={() => {
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/";
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground hover:bg-muted/80 font-bold text-xs uppercase tracking-widest py-3.5 px-5 rounded-xl border border-border transition-all flat-press"
            >
              <Home className="size-4 text-muted-foreground" />
              Torna alla Home
            </button>
          </div>

          {/* Technical Diagnostics */}
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
                    <strong className="text-foreground font-sans">Digest ID:</strong> {error.digest}
                  </p>
                )}
                {error.message && (
                  <p>
                    <strong className="text-foreground font-sans">Dettagli:</strong> {error.message}
                  </p>
                )}
                {!error.digest && !error.message && (
                  <p>Nessun codice diagnostico disponibile.</p>
                )}
              </div>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
