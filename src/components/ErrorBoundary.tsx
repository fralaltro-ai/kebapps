"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
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
            onClick={() => this.setState({ hasError: false })}
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
