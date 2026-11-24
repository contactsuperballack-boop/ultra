import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { LISTING_FEATURES, featuresForKind, sanitizeFeatures, featureLabels } from "../../src/listingFeatures";

describe("listing features", () => {
  test("keys and labels are unique", () => {
    assert.equal(new Set(LISTING_FEATURES.map((f) => f.key)).size, LISTING_FEATURES.length);
    assert.equal(new Set(LISTING_FEATURES.map((f) => f.label)).size, LISTING_FEATURES.length);
  });

  test("land only gets land-appropriate options", () => {
    const keys = featuresForKind("LAND").map((f) => f.key);
    assert.ok(keys.includes("FENCED") && keys.includes("TARRED_ROAD"));
    assert.ok(!keys.includes("SWIMMING_POOL") && !keys.includes("BOYS_QUARTERS"));
  });

  test("sanitize drops duplicates, unknown keys and options not offered for the kind", () => {
    const out = sanitizeFeatures(["CCTV", "CCTV", "NOT_A_FEATURE", "FENCED", "BOREHOLE"], "SALE");
    assert.deepEqual(out, ["CCTV", "BOREHOLE"]);
  });

  test("labels come back in canonical order and skip unknown keys", () => {
    assert.deepEqual(featureLabels(["CCTV", "ENSUITE_ROOMS", "bogus"]), ["All rooms en-suite", "CCTV"]);
    assert.deepEqual(featureLabels(null), []);
  });
});
