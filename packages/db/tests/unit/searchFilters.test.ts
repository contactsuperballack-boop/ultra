import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PRICE_RANGES, filterApplies, normalizeSearchForKind, monthlyEquivalentRange, sortOptionsFor, effectiveSort } from "../../src/searchFilters";

describe("category-aware search", () => {
  test("each kind has contiguous, ascending price ranges", () => {
    for (const kind of ["SALE", "RENT", "LAND"] as const) {
      const r = PRICE_RANGES[kind];
      assert.equal(r[0].minNaira, undefined);
      assert.equal(r[r.length - 1].maxNaira, undefined);
      for (let i = 1; i < r.length; i++) assert.equal(r[i].minNaira, r[i - 1].maxNaira, `${kind} gap at ${i}`);
    }
  });
  test("ranges differ by category (no single universal range)", () => {
    assert.notDeepEqual(PRICE_RANGES.SALE, PRICE_RANGES.RENT);
    assert.notDeepEqual(PRICE_RANGES.SALE, PRICE_RANGES.LAND);
  });
  test("land doesn't offer bedrooms or building category", () => {
    assert.equal(filterApplies("LAND", "bedrooms"), false);
    assert.equal(filterApplies("LAND", "category"), false);
    assert.equal(filterApplies("SALE", "bedrooms"), true);
    assert.equal(filterApplies(undefined, "bedrooms"), true);
  });
  test("a hand-built land search has bedrooms/category stripped", () => {
    assert.deepEqual(normalizeSearchForKind({ type: "LAND" as const, minBeds: 3, minBathrooms: 2, category: "RESIDENTIAL" }), { type: "LAND", minBeds: undefined, minBathrooms: undefined, category: undefined });
    assert.deepEqual(normalizeSearchForKind({ type: "SALE" as const, minBeds: 3 }), { type: "SALE", minBeds: 3 });
  });
  test("annual range converts to a monthly equivalent", () => {
    assert.deepEqual(monthlyEquivalentRange(2_400_000, 4_800_000), { min: 200_000, max: 400_000 });
    assert.deepEqual(monthlyEquivalentRange(undefined, 6_000_000), { min: undefined, max: 500_000 });
  });

  test("price sorting only for sale and land; rentals and 'All' fall back to newest", () => {
    assert.equal(effectiveSort("SALE", "PRICE_ASC"), "PRICE_ASC");
    assert.equal(effectiveSort("LAND", "PRICE_DESC"), "PRICE_DESC");
    assert.equal(effectiveSort("RENT", "PRICE_ASC"), "NEWEST");
    assert.equal(effectiveSort(undefined, "PRICE_DESC"), "NEWEST");
    assert.equal(sortOptionsFor("SALE").length, 3);
    assert.deepEqual(sortOptionsFor("RENT").map((o) => o.value), ["NEWEST"]);
  });
});
