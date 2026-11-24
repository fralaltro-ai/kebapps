import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import Home from "../app/page";
import { resetLocalDbAdapterForTests } from "@/lib/local-storage/db";

describe("Home Page", () => {
  beforeEach(async () => {
    await resetLocalDbAdapterForTests();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders local-first dashboard without redundant guide/footer/backup sections", async () => {
    const { container } = render(<Home />);

    expect(screen.getByText(/Il tuo Diario Kebab personale\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Esplora la Mappa/i })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: /Diario Personale/i })).toHaveAttribute("href", "/diary");
    expect(screen.getByRole("link", { name: /^Wishlist$/i })).toHaveAttribute("href", "/wishlist");

    expect(container.querySelector("footer")).toBeNull();
    expect(screen.queryByText(/Esporta un backup JSON o personalizza avatar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Informazioni su Statistiche/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("stat-total-visits")).toHaveTextContent("0");
    });
    expect(screen.getByTestId("stat-unique-shops")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-wishlist-count")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-kebab-index")).toHaveTextContent("0%");
  });

  test("opens local-first guide popup from hero badge button", async () => {
    render(<Home />);

    const guideBtn = screen.getByTestId("hero-local-guide-btn");
    fireEvent.click(guideBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cos'è KebApps" })).toBeInTheDocument();
    expect(screen.getByText("Locali che vendono kebab sulla mappa")).toBeInTheDocument();
    expect(screen.getByText("Diario personale a 5 dimensioni")).toBeInTheDocument();
    expect(screen.getByText("Wishlist offline e Backup JSON")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chiudi informazioni" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("opens dedicated color-themed modal for each of the 5 stat cards", async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByTestId("stat-total-visits")).toHaveTextContent("0");
    });

    const cases = [
      {
        testId: "stat-card-visits",
        heading: "Kebab Visitati",
        text: /Visite Totali vs Locali Unici/i,
        borderClass: "border-primary/35",
      },
      {
        testId: "stat-card-unique-shops",
        heading: "Locali Unici",
        text: /\+10 XP per Locale Distinto/i,
        borderClass: "border-amber-500/40",
      },
      {
        testId: "stat-card-cities-countries",
        heading: "Città & Nazioni Esplorate",
        text: /\+15 XP Città \/ \+25 XP Nazione/i,
        borderClass: "border-blue-500/40",
      },
      {
        testId: "stat-card-wishlist",
        heading: "Locali in Wishlist",
        text: /Conversione 1-Tap in Diario/i,
        borderClass: "border-emerald-500/40",
      },
      {
        testId: "stat-card-kebab-index",
        heading: "Kebab Index",
        text: /50% · I 4 Voti Base/i,
        borderClass: "border-purple-500/40",
      },
    ];

    for (const item of cases) {
      fireEvent.click(screen.getByTestId(item.testId));
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: item.heading })).toBeInTheDocument();
      expect(screen.getByText(item.text)).toBeInTheDocument();
      expect(dialog.querySelector(`.${item.borderClass.replace("/", "\\/")}`)).not.toBeNull();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  });
});
