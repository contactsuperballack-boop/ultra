import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeUnitNumber, summarizeUnits, inheritedCredits } from "../../src/development";

describe("normalizeUnitNumber", () => {
  test("trims, collapses spaces and uppercases", () => {
    assert.equal(normalizeUnitNumber("  a-12 "), "A-12");
    assert.equal(normalizeUnitNumber("block  b / 7"), "BLOCK B / 7");
    assert.equal(normalizeUnitNumber("12"), "12");
  });
  test("rejects empty, too long, odd characters and non-strings", () => {
    for (const bad of ["", "   ", "x".repeat(21), "<b>1</b>", "A_1", "-1", "unit#4"]) assert.equal(normalizeUnitNumber(bad), null, bad);
    assert.equal(normalizeUnitNumber(undefined), null);
    assert.equal(normalizeUnitNumber(null), null);
  });
  test("unit numbers that differ only by case or spacing collapse to the same value (so uniqueness can't be dodged)", () => {
    assert.equal(normalizeUnitNumber("a 1"), normalizeUnitNumber("A  1"));
  });
});

describe("summarizeUnits", () => {
  test("only LIVE units are available; price range and bedroom options come from them", () => {
    const s = summarizeUnits([
      { priceNaira: 300_000_000n, bedrooms: 3, status: "LIVE" },
      { priceNaira: 450_000_000, bedrooms: 4, status: "LIVE" },
      { priceNaira: 100_000_000, bedrooms: 2, status: "SOLD" },
      { priceNaira: 200_000_000, bedrooms: 3, status: "DRAFT" },
    ]);
    assert.deepEqual(s, { availableCount: 2, minPriceNaira: 300_000_000, maxPriceNaira: 450_000_000, bedroomOptions: [3, 4] });
  });
  test("a development with no live units reports nothing available", () => {
    assert.deepEqual(summarizeUnits([{ priceNaira: 1, status: "SOLD" }]), { availableCount: 0, minPriceNaira: null, maxPriceNaira: null, bedroomOptions: [] });
    assert.equal(summarizeUnits([]).availableCount, 0);
  });
  test("handles a development with 30 units", () => {
    const units = Array.from({ length: 30 }, (_, i) => ({ priceNaira: 200_000_000 + i * 1_000_000, bedrooms: 3 + (i % 2), status: i < 25 ? "LIVE" : "SOLD" }));
    const s = summarizeUnits(units);
    assert.equal(s.availableCount, 25);
    assert.equal(s.minPriceNaira, 200_000_000);
    assert.equal(s.maxPriceNaira, 224_000_000);
    assert.deepEqual(s.bedroomOptions, [3, 4]);
  });
});

describe("inheritedCredits", () => {
  test("a unit inherits blanks from its development but keeps its own values", () => {
    const out = inheritedCredits({ builder: "Unit Builder" }, { architect: "Parent Architect", builder: "Parent Builder", completionYear: 2024 });
    assert.deepEqual(out, { architect: "Parent Architect", builder: "Unit Builder", developer: null, completionYear: 2024 });
  });
  test("works with no development", () => {
    assert.deepEqual(inheritedCredits({ architect: "A" }), { architect: "A", builder: null, developer: null, completionYear: null });
  });
});
