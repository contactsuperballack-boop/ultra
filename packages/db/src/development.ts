// A development (estate, complex, tower) is ONE parent record; each home or
// unit inside it is an ordinary Listing that points at it. Development-level
// facts (name, credits, film) live once on the parent; unit-level facts
// (number, price, bedrooms, availability) stay on each unit. Pure helpers only.

export const MAX_UNIT_NUMBER_LENGTH = 20;

/** "a-12 " -> "A-12". Letters, digits, spaces, dashes and slashes only; null when empty or invalid. */
export function normalizeUnitNumber(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s+/g, " ").toUpperCase();
  if (!cleaned || cleaned.length > MAX_UNIT_NUMBER_LENGTH) return null;
  return /^[A-Z0-9][A-Z0-9 /-]*$/.test(cleaned) ? cleaned : null;
}

export interface UnitLike {
  priceNaira: number | bigint;
  bedrooms?: number | null;
  status: string;
}

export interface UnitSummary {
  availableCount: number;
  minPriceNaira: number | null;
  maxPriceNaira: number | null;
  bedroomOptions: number[];
}

/** Availability and price range across a development's units. Only LIVE units count as available. */
export function summarizeUnits(units: UnitLike[]): UnitSummary {
  const live = units.filter((u) => u.status === "LIVE");
  const prices = live.map((u) => Number(u.priceNaira)).filter((n) => Number.isFinite(n));
  const beds = [...new Set(live.map((u) => u.bedrooms).filter((b): b is number => typeof b === "number"))].sort((a, b) => a - b);
  return {
    availableCount: live.length,
    minPriceNaira: prices.length ? Math.min(...prices) : null,
    maxPriceNaira: prices.length ? Math.max(...prices) : null,
    bedroomOptions: beds,
  };
}

export interface Credits {
  architect?: string | null;
  builder?: string | null;
  developer?: string | null;
  completionYear?: number | null;
}

/** A unit's own credits win; anything it leaves blank is read from its development (not copied into the unit). */
export function inheritedCredits(unit: Credits, development?: Credits | null): Required<{ [K in keyof Credits]: NonNullable<Credits[K]> | null }> {
  const pick = <T,>(own: T | null | undefined, parent: T | null | undefined): T | null => own ?? parent ?? null;
  return {
    architect: pick(unit.architect, development?.architect),
    builder: pick(unit.builder, development?.builder),
    developer: pick(unit.developer, development?.developer),
    completionYear: pick(unit.completionYear, development?.completionYear),
  };
}
