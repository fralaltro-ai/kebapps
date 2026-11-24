import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeCardPanOffset, computeOffsetLatLng } from "../mapOffset";

describe("computeCardPanOffset", () => {
  it("returns 0 when the card is low and easily fits below the search bar without panning", () => {
    // containerHeight: 1000, cardHeight: 200, topOffset: 20
    // safeTop = 20 + 48 + 12 = 80
    // y_card_top = 500 - 200 - 24 = 276 >= 80 -> dy = 0
    const offset = computeCardPanOffset({
      containerHeight: 1000,
      cardHeight: 200,
      topOffset: 20,
    });
    expect(offset).toBe(0);
  });

  it("returns a negative dy satisfying safeTop constraint when card is tall on a short viewport", () => {
    // containerHeight: 640, cardHeight: 420, topOffset: 80
    // safeTop = 80 + 48 + 12 = 140
    // center = 320
    // containerHeight/2 - cardHeight - tailGap - safeTop = 320 - 420 - 24 - 140 = -264
    const offset = computeCardPanOffset({
      containerHeight: 640,
      cardHeight: 420,
      topOffset: 80,
    });
    expect(offset).toBeLessThan(0);
    // Verify that at (containerHeight/2 - offset - tailGap - cardHeight) >= safeTop (or clamped)
    const pinY = 640 / 2 - offset;
    const cardTopY = pinY - 24 - 420;
    expect(cardTopY).toBe(116);
    // With clamp: minDy = -(320 - 80) = -240. So dy is clamped to -240.
    expect(offset).toBe(-240);
  });

  it("calculates exact offset when unclamped", () => {
    // containerHeight: 800, cardHeight: 380, topOffset: 20
    // safeTop = 20 + 48 + 12 = 80
    // center = 400
    // 400 - 380 - 24 - 80 = -84
    // minDy = -(400 - 80) = -320
    // dy = -84
    const offset = computeCardPanOffset({
      containerHeight: 800,
      cardHeight: 380,
      topOffset: 20,
    });
    expect(offset).toBe(-84);
    const pinY = 800 / 2 - offset; // 400 - (-84) = 484
    const cardTopY = pinY - 24 - 380; // 484 - 404 = 80
    expect(cardTopY).toBe(80); // exactly safeTop
  });

  it("clamps dy when card is extremely tall so the pin remains visible within bottom 80px margin", () => {
    // containerHeight: 600, cardHeight: 600, topOffset: 50
    // minDy = -(300 - 80) = -220
    const offset = computeCardPanOffset({
      containerHeight: 600,
      cardHeight: 600,
      topOffset: 50,
    });
    expect(offset).toBe(-220);
  });

  it("returns 0 for invalid or non-positive dimensions", () => {
    expect(computeCardPanOffset({ containerHeight: 0, cardHeight: 300, topOffset: 20 })).toBe(0);
    expect(computeCardPanOffset({ containerHeight: 800, cardHeight: 0, topOffset: 20 })).toBe(0);
    expect(computeCardPanOffset({ containerHeight: -500, cardHeight: 300, topOffset: 20 })).toBe(0);
    expect(computeCardPanOffset({ containerHeight: NaN, cardHeight: 300, topOffset: 20 })).toBe(0);
    expect(computeCardPanOffset({ containerHeight: 800, cardHeight: NaN, topOffset: 20 })).toBe(0);
    expect(computeCardPanOffset({ containerHeight: 800, cardHeight: 300, topOffset: NaN })).toBe(0);
  });
});

describe("computeOffsetLatLng", () => {
  beforeEach(() => {
    (globalThis as unknown as { google: unknown }).google = {
      maps: {
        LatLng: class {
          lat: () => number;
          lng: () => number;
          constructor(lat: number, lng: number) {
            this.lat = () => lat;
            this.lng = () => lng;
          }
        },
        Point: class {
          x: number;
          y: number;
          constructor(x: number, y: number) {
            this.x = x;
            this.y = y;
          }
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { google?: unknown }).google;
  });

  it("returns original latLng when dyPixels is 0 or invalid", () => {
    const mockMap = {} as google.maps.Map;
    const pos = { lat: 45.4642, lng: 9.1900 };
    expect(computeOffsetLatLng(mockMap, pos, 0)).toEqual(pos);
    expect(computeOffsetLatLng(mockMap, pos, NaN)).toEqual(pos);
  });

  it("returns original latLng when map projection is not ready", () => {
    const mockMap = {
      getProjection: () => null,
      getZoom: () => 15,
    } as unknown as google.maps.Map;
    const pos = { lat: 45.4642, lng: 9.1900 };
    expect(computeOffsetLatLng(mockMap, pos, -100)).toEqual(pos);
  });

  it("computes projected offset latitude when projection and zoom are present", () => {
    const mockProjection = {
      fromLatLngToPoint: () => ({
        x: 100,
        y: 100,
      }),
      fromPointToLatLng: () => ({
        lat: () => 45.4700,
        lng: () => 9.1900,
      }),
    };

    const mockMap = {
      getProjection: () => mockProjection,
      getZoom: () => 15,
    } as unknown as google.maps.Map;

    const pos = { lat: 45.4642, lng: 9.1900 };
    const offsetPos = computeOffsetLatLng(mockMap, pos, -120);

    expect(offsetPos.lat).toBe(45.4700);
    expect(offsetPos.lng).toBe(9.1900);
  });
});

