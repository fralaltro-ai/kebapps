import React from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Navigation from "@/components/layout/Navigation";
import ProfileClient from "@/app/profile/ProfileClient";
import ProfilePreferencesClient from "@/components/profile/ProfilePreferencesClient";
import ProfileDataClient from "@/components/profile/ProfileDataClient";
import { ToastProvider } from "@/context/ToastContext";
import { resetLocalDbAdapterForTests } from "@/lib/local-storage/db";

let mockPathname = "/";
const mockSetTheme = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: any) => <img {...props} />,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: mockSetTheme }),
}));

describe("Navigation & Profile Hub / Subpages", () => {
  beforeEach(async () => {
    await resetLocalDbAdapterForTests();
    localStorage.clear();
    mockPathname = "/";
    mockSetTheme.mockClear();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("Navigation renders 4 main menu items and highlights topbar Profilo on /profile routes", () => {
    mockPathname = "/profile/preferences";
    const { container } = render(
      <ToastProvider>
        <Navigation />
      </ToastProvider>
    );

    const dockGrid = container.querySelector(".grid.grid-cols-4");
    expect(dockGrid).not.toBeNull();
    expect(container.querySelector(".grid.grid-cols-5")).toBeNull();

    for (const label of ["Home", "Mappa", "Diario", "Wishlist"]) {
      expect(screen.getAllByRole("link", { name: label })).toHaveLength(2);
    }

    const profileBtn = screen.getByRole("link", { name: "Profilo e Dati Locali" });
    expect(profileBtn).toHaveAttribute("href", "/profile");
    expect(profileBtn).toHaveAttribute("aria-current", "page");
    expect(profileBtn.className).toContain("bg-primary/15");
  });

  it("ProfileClient renders essential boxes, omits redundant counters grid, and links 3 settings subpages", async () => {
    render(
      <ToastProvider>
        <ProfileClient />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("profile-heading-nickname")).toHaveTextContent(
        "Esploratore dello Spiedo"
      );
    });

    expect(screen.queryByRole("link", { name: /Apri Diario/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Kebab Index")).not.toBeInTheDocument();
    expect(screen.getByText("Progressione & Badge")).toBeInTheDocument();
    expect(screen.getByText("Pioniere")).toBeInTheDocument();

    expect(screen.getByTestId("profile-nav-preferences")).toHaveAttribute(
      "href",
      "/profile/preferences"
    );
    expect(screen.getByTestId("profile-nav-data")).toHaveAttribute("href", "/profile/data");
    expect(screen.getByTestId("profile-nav-info")).toHaveAttribute("href", "/profile/info");
  });

  it("ProfilePreferencesClient allows switching theme and toggling Maps/GPS consents", () => {
    render(
      <ToastProvider>
        <ProfilePreferencesClient />
      </ToastProvider>
    );

    const darkBtn = screen.getByRole("button", { name: "Scuro" });
    fireEvent.click(darkBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");

    const mapsBtn = screen.getByTestId("toggle-maps-consent-btn");
    expect(mapsBtn).toHaveTextContent("Attiva");
    fireEvent.click(mapsBtn);
    expect(mapsBtn).toHaveTextContent("Revoca");

    const gpsBtn = screen.getByTestId("toggle-gps-consent-btn");
    expect(gpsBtn).toHaveTextContent("Attiva");
    fireEvent.click(gpsBtn);
    expect(gpsBtn).toHaveTextContent("Revoca");
  });

  it("ProfileDataClient displays storage estimate and handles reset confirmation", async () => {
    render(
      <ToastProvider>
        <ProfileDataClient />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("storage-usage-total")).not.toHaveTextContent("–");
    });

    expect(screen.getByTestId("export-backup-btn")).toBeInTheDocument();
    expect(screen.getByTestId("import-backup-trigger")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reset-all-data-btn"));
    expect(screen.getByTestId("reset-confirm-box")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-reset-all-btn"));

    await waitFor(() => {
      expect(screen.queryByTestId("reset-confirm-box")).not.toBeInTheDocument();
    });
  });
});
