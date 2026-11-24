/**
 * Extracted from routers/listings.ts so it can be unit tested without a
 * database — see tests/unit/priceBand.test.ts. Business logic per
 * Blueprint §8/§9: "auto-approve inside a reasonable range, flag anything
 * outside it for internal review." These bands are deliberately crude
 * starting values, tightened from real data over time, not solved in advance.
 */
export const PRICE_BAND_PER_SQM_NAIRA: Record<string, [number, number]> = {
  Maitama: [350_000, 900_000],
  Asokoro: [350_000, 900_000],
  "Wuse 2": [250_000, 600_000],
  Jabi: [180_000, 450_000],
  Gwarinpa: [80_000, 250_000],
  Guzape: [80_000, 250_000],
};

export function checkPriceBand(area: string, priceNaira: number, sizeSqm: number): string | null {
  const band = PRICE_BAND_PER_SQM_NAIRA[area];
  if (!band) return null; // unknown area — no band to check against yet
  const perSqm = priceNaira / sizeSqm;
  const [min, max] = band;
  if (perSqm < min) {
    return `Price is unusually low for ${area} (\u20a6${Math.round(perSqm).toLocaleString()}/m\u00b2 vs typical \u20a6${min.toLocaleString()}\u2013\u20a6${max.toLocaleString()}/m\u00b2) — flagged for review.`;
  }
  if (perSqm > max) {
    return `Price is unusually high for ${area} (\u20a6${Math.round(perSqm).toLocaleString()}/m\u00b2 vs typical \u20a6${min.toLocaleString()}\u2013\u20a6${max.toLocaleString()}/m\u00b2) — flagged for review.`;
  }
  return null;
}
