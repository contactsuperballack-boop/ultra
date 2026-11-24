import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkPriceBand } from "../../src/priceBand";

describe("checkPriceBand", () => {
  test("returns null for a price inside the band", () => {
    // Maitama band is 350,000–900,000 per sqm. 500,000/sqm on a 400sqm plot = 200,000,000 total.
    const result = checkPriceBand("Maitama", 200_000_000, 400);
    assert.equal(result, null);
  });

  test("flags a price above the band as unusually high", () => {
    // 900,000/sqm ceiling for Maitama — push well above it.
    const result = checkPriceBand("Maitama", 500_000_000, 400); // 1,250,000/sqm
    assert.notEqual(result, null);
    assert.match(result!, /unusually high/);
    assert.match(result!, /Maitama/);
  });

  test("flags a price below the band as unusually low", () => {
    const result = checkPriceBand("Maitama", 50_000_000, 400); // 125,000/sqm, below 350,000 floor
    assert.notEqual(result, null);
    assert.match(result!, /unusually low/);
  });

  test("returns null for an area with no defined band", () => {
    const result = checkPriceBand("Kubwa", 10_000_000, 100);
    assert.equal(result, null);
  });

  test("boundary: exactly at the floor is not flagged", () => {
    // Gwarinpa band floor is 80,000/sqm exactly.
    const result = checkPriceBand("Gwarinpa", 8_000_000, 100); // exactly 80,000/sqm
    assert.equal(result, null);
  });

  test("boundary: exactly at the ceiling is not flagged", () => {
    // Gwarinpa band ceiling is 250,000/sqm exactly.
    const result = checkPriceBand("Gwarinpa", 25_000_000, 100); // exactly 250,000/sqm
    assert.equal(result, null);
  });

  test("boundary: one naira over the ceiling IS flagged", () => {
    const result = checkPriceBand("Gwarinpa", 25_000_001, 100); // 250,000.01/sqm
    assert.notEqual(result, null);
  });

  test("cross-check against seed data: Guzape at ₦65M/1200m² is priced below the band and should be flagged", () => {
    // This caught a real bug during development: packages/db/prisma/seed.ts
    // used to hand-write a flagReason claiming this listing was "40% above
    // typical range," but ₦65,000,000 / 1200m² ≈ ₦54,167/m², which is BELOW
    // Guzape's ₦80,000 floor, not above the ₦250,000 ceiling. The seed now
    // calls checkPriceBand directly instead of hand-writing the reason, so
    // this kind of drift can't happen again.
    const result = checkPriceBand("Guzape", 65_000_000, 1200);
    assert.notEqual(result, null);
    assert.match(result!, /unusually low/);
  });
});
