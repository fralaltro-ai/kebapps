import React from "react";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OnboardingModal from "../components/ui/OnboardingModal";
import { PWA_KEYS } from "@/lib/pwa-utils";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: any) => <img {...props} />,
}));

describe("OnboardingModal", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/";
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
  });

  it("does not render anything before the delay elapses", () => {
    render(<OnboardingModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the modal with color logo and accurate local-first copy after delay", () => {
    render(<OnboardingModal />);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Benvenuto in/i)).toBeInTheDocument();

    const logo = screen.getByAltText("KebApps");
    expect(logo.className).not.toContain("brightness-0");
    expect(logo.className).not.toContain("invert");

    expect(screen.getByText(/ricerca On-Submit/i)).toBeInTheDocument();
    expect(screen.getByText(/Carne, Pane, Salse, Qualità\/Prezzo e Location opzionale/i)).toBeInTheDocument();
    expect(screen.getByText(/IndexedDB/i)).toBeInTheDocument();
    expect(screen.getByText(/14 anni/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy/i })).toHaveAttribute("href", "/privacy-policy");
    expect(screen.getByRole("link", { name: /Cookie/i })).toHaveAttribute("href", "/cookie-policy");
    expect(screen.getByRole("link", { name: /Termini/i })).toHaveAttribute("href", "/terms");
    expect(screen.queryByText(/in tempo reale/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Inizia l'Evoluzione/i)).not.toBeInTheDocument();
  });

  it("does not render if kebapp_onboarding_seen is already set", () => {
    localStorage.setItem(PWA_KEYS.ONBOARDING_SEEN, "true");
    render(<OnboardingModal />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render on legal policy routes", () => {
    mockPathname = "/privacy-policy";
    render(<OnboardingModal />);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sets kebapp_onboarding_seen and closes when the CTA is clicked", () => {
    render(<OnboardingModal />);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const cta = screen.getByRole("button", { name: /inizia ora/i });
    fireEvent.click(cta);

    expect(localStorage.getItem(PWA_KEYS.ONBOARDING_SEEN)).toBe("true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
