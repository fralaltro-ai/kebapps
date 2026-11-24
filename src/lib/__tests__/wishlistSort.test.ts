import { describe, it, expect } from "vitest";
import { filterWishlistBySegment, sortWishlistByDistance, WishlistSortableItem } from "../wishlistSort";

interface TestItem extends WishlistSortableItem {
  name: string;
}

const items: TestItem[] = [
  { id: "a", has_reviewed: false, distanceKm: 5, name: "A" },
  { id: "b", has_reviewed: true, distanceKm: 1, name: "B" },
  { id: "c", has_reviewed: false, distanceKm: null, name: "C" },
  { id: "d", has_reviewed: true, distanceKm: 2.5, name: "D" },
];

describe("filterWishlistBySegment", () => {
  it("returns everything unfiltered for 'all'", () => {
    expect(filterWishlistBySegment(items, "all")).toHaveLength(4);
  });

  it("keeps only unreviewed shops for 'todo'", () => {
    const result = filterWishlistBySegment(items, "todo");
    expect(result.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("keeps only reviewed shops for 'visited'", () => {
    const result = filterWishlistBySegment(items, "visited");
    expect(result.map((i) => i.id)).toEqual(["b", "d"]);
  });

  it("never mutates the input array", () => {
    const copy = [...items];
    filterWishlistBySegment(items, "todo");
    expect(items).toEqual(copy);
  });
});

describe("sortWishlistByDistance", () => {
  it("orders from nearest to farthest", () => {
    const result = sortWishlistByDistance(items);
    expect(result.map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("never drops an item — shops with unknown distance go last, not missing", () => {
    const result = sortWishlistByDistance(items);
    expect(result).toHaveLength(items.length);
    expect(result.find((i) => i.id === "c")).toBeDefined();
    expect(result[result.length - 1].id).toBe("c");
  });

  it("is deterministic when all distances are unknown (stable order, no crash)", () => {
    const allUnknown: TestItem[] = items.map((i) => ({ ...i, distanceKm: null }));
    const result = sortWishlistByDistance(allUnknown);
    expect(result.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not mutate the input array (so the manual order can be restored)", () => {
    const original = [...items];
    sortWishlistByDistance(items);
    expect(items).toEqual(original);
  });
});
