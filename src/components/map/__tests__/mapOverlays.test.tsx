import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import ShopInfoCard from "../ShopInfoCard";
import UnverifiedShopCard from "../UnverifiedShopCard";
import MapSearchBar from "../MapSearchBar";
import RoutingPanel from "../RoutingPanel";

describe("Map Popups & Search Bar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ShopInfoCard as a centered dialog overlay above navigation/search layers", () => {
    const onClose = vi.fn();
    render(
      <ShopInfoCard
        shop={{
          place_id: "shop-1",
          name: "Istanbul Doner",
          latitude: 45.46,
          longitude: 9.18,
          address: "Via Torino 18, Milano",
        }}
        userLocation={null}
        onStartRouting={vi.fn()}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain("fixed");
    expect(dialog.className).toContain("inset-0");
    expect(dialog.className).toContain("items-center");
    expect(dialog.className).toContain("justify-center");
    expect(dialog.className).toContain("z-[105]");
    expect(screen.getByText("Istanbul Doner")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes ShopInfoCard on backdrop click without closing on inner card click", () => {
    const onClose = vi.fn();
    render(
      <ShopInfoCard
        shop={{
          place_id: "shop-2",
          name: "Anatolia Kebab",
          latitude: 45.47,
          longitude: 9.2,
        }}
        userLocation={null}
        onStartRouting={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText("Anatolia Kebab"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders UnverifiedShopCard as a centered dialog overlay", () => {
    const onClose = vi.fn();
    render(
      <UnverifiedShopCard
        unverifiedPlace={{
          placeId: "poi-1",
          latLng: { lat: 45.46, lng: 9.19 },
        }}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("fixed");
    expect(dialog.className).toContain("items-center");
    expect(dialog.className).toContain("justify-center");
    expect(dialog.className).toContain("z-[105]");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits MapSearchBar only once on form submit (no duplicate onKeyDown)", () => {
    const onSearchSubmit = vi.fn((e?: React.FormEvent | React.KeyboardEvent) => e?.preventDefault());
    render(
      <MapSearchBar
        searchQuery="Milano"
        isSearching={false}
        searchError={null}
        topOffset={16}
        onSearchChange={vi.fn()}
        onSearchSubmit={onSearchSubmit}
        onClear={vi.fn()}
      />
    );

    const input = screen.getByLabelText("Cerca luogo o indirizzo");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearchSubmit).not.toHaveBeenCalled();

    fireEvent.submit(input.closest("form")!);
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders RoutingPanel with estimates, handles travel mode changes, and triggers onCancel", () => {
    const onCancel = vi.fn();
    const onTravelModeChange = vi.fn();

    render(
      <RoutingPanel
        destination={{
          place_id: "dest-1",
          name: "Meydan Kebab",
          latitude: 45.47,
          longitude: 9.19,
        }}
        routingInfo={{ distance: "1.2 km", duration: "15 min" }}
        travelMode="WALKING"
        onTravelModeChange={onTravelModeChange}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("15 min")).toBeInTheDocument();
    expect(screen.getByText("(1.2 km)")).toBeInTheDocument();
    expect(screen.getByText("Verso Meydan Kebab")).toBeInTheDocument();

    // Mode change button
    const drivingBtn = screen.getByLabelText("Modalità in auto");
    fireEvent.click(drivingBtn);
    expect(onTravelModeChange).toHaveBeenCalledWith("DRIVING");

    // Exit / Cancel button
    const cancelBtn = screen.getByRole("button", { name: /Esci/i });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("prompts for user-provided label when saving a Google EEA shop without name to Wishlist or Diary", () => {
    const onToggleWishlist = vi.fn();
    render(
      <ShopInfoCard
        shop={{
          place_id: "ChIJ_google_only",
          name: null,
          latitude: 45.46,
          longitude: 9.19,
          data_source: "google",
        }}
        userLocation={null}
        onToggleWishlist={onToggleWishlist}
        onStartRouting={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Wishlist/i }));
    expect(onToggleWishlist).not.toHaveBeenCalled();

    const wishlistInput = screen.getByLabelText(/Nome per la tua Wishlist/i);
    fireEvent.change(wishlistInput, { target: { value: "Mio Kebab Test" } });
    fireEvent.click(screen.getByRole("button", { name: /Salva in Wishlist/i }));

    expect(onToggleWishlist).toHaveBeenCalledWith(
      expect.objectContaining({ place_id: "ChIJ_google_only" }),
      "Mio Kebab Test"
    );
  });

  it("renders RoutingPanel safely when destination.name is null", () => {
    render(
      <RoutingPanel
        destination={{
          place_id: "ChIJ_dest_only",
          name: null,
          latitude: 45.47,
          longitude: 9.19,
        }}
        routingInfo={{ distance: "500 m", duration: "7 min" }}
        travelMode="WALKING"
        onTravelModeChange={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Verso il locale selezionato")).toBeInTheDocument();
  });
});
