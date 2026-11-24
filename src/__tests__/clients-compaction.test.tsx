import React from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import WishlistClient from "@/app/wishlist/WishlistClient";
import DiaryClient from "@/app/diary/DiaryClient";
import { ToastProvider } from "@/context/ToastContext";
import {
  resetLocalDbAdapterForTests,
  upsertWishlistEntry,
  upsertDiaryEntry,
} from "@/lib/local-storage/db";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/diary",
}));

describe("WishlistClient & DiaryClient Compaction / Smoke", () => {
  beforeEach(async () => {
    await resetLocalDbAdapterForTests();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("WishlistClient", () => {
    it("renders empty state and SectionInfoButton guide when wishlist is empty", async () => {
      render(
        <ToastProvider>
          <WishlistClient />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Nessun locale in Wishlist")).toBeInTheDocument();
      });

      const infoBtn = screen.getByRole("button", { name: "Informazioni su Wishlist Locale" });
      expect(infoBtn).toBeInTheDocument();

      fireEvent.click(infoBtn);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Ordinamento Data vs Distanza Offline")).toBeInTheDocument();
    });

    it("renders seeded wishlist items, allows toggling sort mode", async () => {
      await upsertWishlistEntry({
        place_id: "place-wish-1",
        shop_label: "Anatolia Kebap",
        latitude: 45.462,
        longitude: 9.185,
        note: "Consigliato da Mario",
      });

      render(
        <ToastProvider>
          <WishlistClient />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Anatolia Kebap")).toBeInTheDocument();
      });

      expect(screen.getByText("Consigliato da Mario")).toBeInTheDocument();

      const dateSortBtn = screen.getByTestId("wishlist-sort-date");
      const distSortBtn = screen.getByTestId("wishlist-sort-distance");
      expect(dateSortBtn).toBeInTheDocument();
      expect(distSortBtn).toBeInTheDocument();

      fireEvent.click(distSortBtn);
      expect(distSortBtn.className).toContain("bg-primary");
    });
  });

  describe("DiaryClient", () => {
    it("renders empty state and SectionInfoButton guide when diary is empty", async () => {
      render(
        <ToastProvider>
          <DiaryClient />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Il tuo Diario è ancora vuoto")).toBeInTheDocument();
      });

      const infoBtn = screen.getByRole("button", { name: "Informazioni su Diario Personale" });
      expect(infoBtn).toBeInTheDocument();

      fireEvent.click(infoBtn);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Le 5 Dimensioni del Voto")).toBeInTheDocument();
    });

    it("renders custom flat filter/sort pills without native select and handles search clear", async () => {
      await upsertDiaryEntry({
        place_id: "place-1",
        shop_label: "Pasha Istanbul",
        city: "Milano",
        country: "Italia",
        latitude: 45.464,
        longitude: 9.189,
        score_meat: 5,
        score_bread: 5,
        score_sauces: 4,
        score_value: 5,
        score_location: 4,
        note: "Carne favolosa, pane croccante!",
        visited_at: new Date().toISOString(),
      });

      await upsertDiaryEntry({
        place_id: "place-2",
        shop_label: "Anatolia Express",
        city: "Roma",
        country: "Italia",
        latitude: 41.9,
        longitude: 12.5,
        score_meat: 3,
        score_bread: 3,
        score_sauces: 3,
        score_value: 3,
        score_location: null,
        note: "Onesto spuntino.",
        visited_at: new Date(Date.now() - 10_000).toISOString(),
      });

      render(
        <ToastProvider>
          <DiaryClient />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Pasha Istanbul")).toBeInTheDocument();
      });

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

      const allFilterBtn = screen.getByRole("button", { name: "Tutti" });
      const fourPlusFilterBtn = screen.getByRole("button", { name: "4.0+" });
      const dreamFilterBtn = screen.getByRole("button", { name: "4.5+ Da Sogno" });

      expect(allFilterBtn).toHaveAttribute("aria-pressed", "true");
      expect(fourPlusFilterBtn).toHaveAttribute("aria-pressed", "false");
      expect(dreamFilterBtn).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(fourPlusFilterBtn);
      expect(fourPlusFilterBtn).toHaveAttribute("aria-pressed", "true");
      expect(fourPlusFilterBtn.className).toContain("bg-primary");
      expect(screen.getByText("Pasha Istanbul")).toBeInTheDocument();
      expect(screen.queryByText("Anatolia Express")).not.toBeInTheDocument();

      fireEvent.click(allFilterBtn);
      expect(screen.getByText("Anatolia Express")).toBeInTheDocument();

      const sortNameBtn = screen.getByTestId("diary-sort-name");
      const sortScoreBtn = screen.getByTestId("diary-sort-score");
      expect(screen.getByTestId("diary-sort-recent")).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(sortNameBtn);
      expect(sortNameBtn).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(sortScoreBtn);
      expect(sortScoreBtn).toHaveAttribute("aria-pressed", "true");

      const searchInput = screen.getByTestId("diary-search-input");
      expect(screen.queryByTestId("diary-search-clear-btn")).not.toBeInTheDocument();
      fireEvent.change(searchInput, { target: { value: "Pasha" } });
      expect(screen.queryByText("Anatolia Express")).not.toBeInTheDocument();

      const clearBtn = screen.getByTestId("diary-search-clear-btn");
      fireEvent.click(clearBtn);
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("Anatolia Express")).toBeInTheDocument();
    });
  });
});
