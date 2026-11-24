import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { MapLoadingScreen } from "../MapLoadingScreen";

describe("MapLoadingScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with role='status', aria-busy='true' and default labels", () => {
    render(<MapLoadingScreen />);

    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute("aria-busy", "true");
    expect(statusEl).toHaveAttribute("aria-label", "Ricerca locali in corso...");
    expect(screen.getByText("Ricerca locali in corso...")).toBeInTheDocument();
    expect(screen.getByText("Preparazione mappa")).toBeInTheDocument();
  });

  it("renders custom title, subtitle, and stepLabel when provided", () => {
    render(
      <MapLoadingScreen
        title="Caricamento Spiedo"
        subtitle="Connessione in corso"
        stepLabel="Passo 2 di 3"
      />
    );

    expect(screen.getByRole("heading", { name: "Caricamento Spiedo" })).toBeInTheDocument();
    expect(screen.getByText("Connessione in corso")).toBeInTheDocument();
    expect(screen.getByText("Passo 2 di 3")).toBeInTheDocument();
  });

  it("omits stepLabel badge if not provided", () => {
    const { container } = render(<MapLoadingScreen />);
    expect(container.querySelector(".rounded-xl.bg-muted")).toBeNull();
  });

  it("sets pointer-events-auto and opacity-100 when isOverlay=true and isInitialLoading=true", () => {
    render(<MapLoadingScreen isOverlay={true} isInitialLoading={true} />);

    const statusEl = screen.getByRole("status");
    expect(statusEl.className).toContain("absolute");
    expect(statusEl.className).toContain("inset-0");
    expect(statusEl.className).toContain("opacity-100");
    expect(statusEl.className).toContain("pointer-events-auto");
    expect(statusEl).toHaveAttribute("aria-busy", "true");
  });

  it("sets pointer-events-none and opacity-0 when isOverlay=true and isInitialLoading=false", () => {
    render(<MapLoadingScreen isOverlay={true} isInitialLoading={false} />);

    const statusEl = screen.getByRole("status");
    expect(statusEl.className).toContain("opacity-0");
    expect(statusEl.className).toContain("pointer-events-none");
    expect(statusEl).toHaveAttribute("aria-busy", "false");
  });

  it("sets correct classes in non-overlay mode", () => {
    const { rerender } = render(<MapLoadingScreen isOverlay={false} isInitialLoading={true} />);
    const activeEl = screen.getByRole("status");
    expect(activeEl.className).toContain("pointer-events-auto");
    expect(activeEl.className).not.toContain("absolute");

    rerender(<MapLoadingScreen isOverlay={false} isInitialLoading={false} />);
    const inactiveEl = screen.getByRole("status");
    expect(inactiveEl.className).toContain("pointer-events-none");
    expect(inactiveEl).toHaveAttribute("aria-busy", "false");
  });

  it("does not render fixed progress bar in loading screen", () => {
    const { container } = render(<MapLoadingScreen />);
    expect(container.querySelector(".w-48.h-1\\.5")).toBeNull();
  });
});
