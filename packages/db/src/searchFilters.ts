// Category-aware search rules, ported from the prototype's marketplace
// filtering idea: each discovery category (Buy / To Let / Land) gets its own
// price ranges and its own set of applicable filters, instead of one
// universal range and a bedrooms box on a plot of land.

export type SearchKind = "SALE" | "RENT" | "LAND";
export type SearchFilterKey = "category" | "bedrooms" | "price" | "verified";

export interface PriceRange {
  label: string;
  minNaira?: number;
  maxNaira?: number;
}

const M = 1_000_000;

/** Rent ranges are PER YEAR; the API normalises monthly-priced rentals before comparing. */
export const PRICE_RANGES: Record<SearchKind, PriceRange[]> = {
  SALE: [
    { label: "Under ₦50M", maxNaira: 50 * M },
    { label: "₦50M – ₦150M", minNaira: 50 * M, maxNaira: 150 * M },
    { label: "₦150M – ₦400M", minNaira: 150 * M, maxNaira: 400 * M },
    { label: "Over ₦400M", minNaira: 400 * M },
  ],
  RENT: [
    { label: "Under ₦2M / yr", maxNaira: 2 * M },
    { label: "₦2M – ₦5M / yr", minNaira: 2 * M, maxNaira: 5 * M },
    { label: "₦5M – ₦15M / yr", minNaira: 5 * M, maxNaira: 15 * M },
    { label: "Over ₦15M / yr", minNaira: 15 * M },
  ],
  LAND: [
    { label: "Under ₦30M", maxNaira: 30 * M },
    { label: "₦30M – ₦100M", minNaira: 30 * M, maxNaira: 100 * M },
    { label: "₦100M – ₦300M", minNaira: 100 * M, maxNaira: 300 * M },
    { label: "Over ₦300M", minNaira: 300 * M },
  ],
};

export const FILTERS_BY_KIND: Record<SearchKind, readonly SearchFilterKey[]> = {
  SALE: ["category", "bedrooms", "price", "verified"],
  RENT: ["category", "bedrooms", "price", "verified"],
  LAND: ["price", "verified"],
};

export const SORT_OPTIONS = [
  { value: "NEWEST", label: "Newest" },
  { value: "PRICE_ASC", label: "Price: low to high" },
  { value: "PRICE_DESC", label: "Price: high to low" },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export function filterApplies(kind: SearchKind | undefined, filter: SearchFilterKey): boolean {
  return kind ? FILTERS_BY_KIND[kind].includes(filter) : true;
}

/** Plots have no bedrooms or building category: ignore them rather than return nonsense for a hand-built request. */
export function normalizeSearchForKind<T extends { type?: SearchKind; minBeds?: number; minBathrooms?: number; category?: string }>(input: T): T {
  if (input.type === "LAND") return { ...input, minBeds: undefined, minBathrooms: undefined, category: undefined };
  return input;
}

/** For rentals priced per month, the annual range [min,max] becomes [min/12, max/12]. */
export function monthlyEquivalentRange(minNaira?: number, maxNaira?: number): { min?: number; max?: number } {
  return {
    min: minNaira === undefined ? undefined : Math.ceil(minNaira / 12),
    max: maxNaira === undefined ? undefined : Math.floor(maxNaira / 12),
  };
}

/**
 * Price sorting is only meaningful within one price basis. Sale and land are
 * one-off prices; rentals mix per-year and per-month prices (and "All"
 * mixes sale with rent), so those fall back to newest-first rather than
 * returning a misleading order.
 */
export function priceSortAllowed(kind?: SearchKind): boolean {
  return kind === "SALE" || kind === "LAND";
}

export function sortOptionsFor(kind?: SearchKind) {
  return priceSortAllowed(kind) ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.value === "NEWEST");
}

export function effectiveSort(kind: SearchKind | undefined, requested: SortOption): SortOption {
  return priceSortAllowed(kind) ? requested : "NEWEST";
}
