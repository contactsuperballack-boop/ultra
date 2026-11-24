// MIRROR of packages/db/src/listingFeatures.ts — keep in sync (same pattern as theme.ts and mortgage.ts).
// The fixed set of amenities a realtor can tick on a listing. A closed list
// (not free text) on purpose: buyers see consistent wording, the API can
// reject anything outside it, and nothing a realtor types can reach a page.
// Keys are what's stored; labels are what's shown.

export type ListingKind = "SALE" | "RENT" | "LAND";

export const LISTING_FEATURES = [
  { key: "ENSUITE_ROOMS", label: "All rooms en-suite", kinds: ["SALE", "RENT"] },
  { key: "FITTED_KITCHEN", label: "Fitted kitchen", kinds: ["SALE", "RENT"] },
  { key: "BOYS_QUARTERS", label: "Boys' quarters (BQ)", kinds: ["SALE", "RENT"] },
  { key: "COVERED_PARKING", label: "Covered parking", kinds: ["SALE", "RENT"] },
  { key: "AC_PREINSTALL", label: "A/C pre-installation", kinds: ["SALE", "RENT"] },
  { key: "INVERTER", label: "Inverter system", kinds: ["SALE", "RENT"] },
  { key: "SOLAR", label: "Solar power", kinds: ["SALE", "RENT"] },
  { key: "BOREHOLE", label: "Borehole", kinds: ["SALE", "RENT", "LAND"] },
  { key: "WATER_TREATMENT", label: "Water treatment system", kinds: ["SALE", "RENT"] },
  { key: "SWIMMING_POOL", label: "Swimming pool", kinds: ["SALE", "RENT"] },
  { key: "GYM", label: "Gym", kinds: ["SALE", "RENT"] },
  { key: "ELEVATOR", label: "Elevator", kinds: ["SALE", "RENT"] },
  { key: "CCTV", label: "CCTV", kinds: ["SALE", "RENT"] },
  { key: "SECURITY_24_7", label: "24/7 security", kinds: ["SALE", "RENT", "LAND"] },
  { key: "GATED_ESTATE", label: "Gated estate", kinds: ["SALE", "RENT", "LAND"] },
  { key: "FENCED", label: "Fenced", kinds: ["LAND"] },
  { key: "TARRED_ROAD", label: "Tarred road access", kinds: ["LAND"] },
] as const;

export type ListingFeatureKey = (typeof LISTING_FEATURES)[number]["key"];

/** Tuple form, for z.enum(). */
export const LISTING_FEATURE_KEYS = LISTING_FEATURES.map((f) => f.key) as unknown as [ListingFeatureKey, ...ListingFeatureKey[]];

const LABELS: Record<string, string> = Object.fromEntries(LISTING_FEATURES.map((f) => [f.key, f.label]));

export function featuresForKind(kind: ListingKind) {
  return LISTING_FEATURES.filter((f) => (f.kinds as readonly string[]).includes(kind));
}

/** Drop duplicates and anything not offered for this kind of listing. */
export function sanitizeFeatures(keys: readonly string[], kind: ListingKind): ListingFeatureKey[] {
  const allowed = new Set<string>(featuresForKind(kind).map((f) => f.key));
  return [...new Set(keys)].filter((k): k is ListingFeatureKey => allowed.has(k));
}

/** Labels for display, in the canonical order; unknown keys are skipped. */
export function featureLabels(keys: readonly string[] | null | undefined): string[] {
  if (!keys?.length) return [];
  const set = new Set(keys);
  return LISTING_FEATURES.filter((f) => set.has(f.key)).map((f) => f.label);
}
