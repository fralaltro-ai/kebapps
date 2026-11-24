"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  attemptOneShotChunkRecovery,
  isChunkOrSkewError,
  triggerHardReload,
} from "@/lib/chunk-error-recovery";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (isChunkOrSkewError(error) && attemptOneShotChunkRecovery()) {
      triggerHardReload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
          <h2 className="text-2xl font-black text-foreground mb-4 shadow-flat p-4 rounded-2xl bg-card border border-border font-quicksand">
            Ops! Qualcosa è andato storto
          </h2>
          <p className="text-muted-foreground mb-6 text-sm max-w-sm">
            Si è verificato un errore imprevisto. Prova a ricaricare la pagina.
          </p>
          <button
            onClick={() => {
              if (isChunkOrSkewError(this.state.error)) {
                triggerHardReload();
                return;
              }
              this.setState({ hasError: false, error: null });
            }}
            className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl shadow-flat flat-press transition-all"
          >
            Riprova
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
