export type WishlistSegment = "all" | "todo" | "visited";

export interface WishlistSortableItem {
  id: string;
  has_reviewed: boolean;
  distanceKm?: number | null;
}

/**
 * Filtra per stato ("Tutti" / "Da Provare" / "Visitati") senza mai riordinare:
 * l'ordine relativo (manuale o per distanza, applicato altrove) resta intatto.
 */
export function filterWishlistBySegment<T extends WishlistSortableItem>(
  items: T[],
  segment: WishlistSegment
): T[] {
  if (segment === "todo") return items.filter((i) => !i.has_reviewed);
  if (segment === "visited") return items.filter((i) => i.has_reviewed);
  return items;
}

/**
 * Ordina temporaneamente dal più vicino al più lontano. Non esclude MAI un
 * locale: quelli senza distanza nota (GPS non ancora disponibile o locale
 * senza coordinate) restano in coda, in ordine stabile fra loro.
 * Non muta l'array in input.
 */
export function sortWishlistByDistance<T extends WishlistSortableItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aKm = a.distanceKm ?? null;
    const bKm = b.distanceKm ?? null;
    if (aKm === null && bKm === null) return 0;
    if (aKm === null) return 1;
    if (bKm === null) return -1;
    return aKm - bKm;
  });
}
