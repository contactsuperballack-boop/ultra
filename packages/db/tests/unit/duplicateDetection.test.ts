import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectDuplicateSignals, DUPLICATE_REVIEW_THRESHOLD, type DuplicateCandidate } from "../../src/duplicateDetection";

function makeCandidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    id: undefined,
    title: "3 Bedroom Duplex in Maitama",
    description: "A lovely duplex with a garden and parking space.",
    area: "Maitama",
    city: "Abuja",
    type: "SALE",
    priceNaira: 150_000_000n,
    bedrooms: 3,
    realtorProfileId: "realtor_1",
    realtorPhone: "+2348010000001",
    photoHashes: [],
    ...overrides,
  };
}

describe("detectDuplicateSignals", () => {
  test("no signals when nothing matches", () => {
    const candidate = makeCandidate();
    const result = detectDuplicateSignals(candidate, [
      makeCandidate({ id: "other", area: "Wuse", priceNaira: 90_000_000n, title: "Spacious 2 Bedroom Flat in Wuse II" }),
    ]);
    assert.equal(result.signals.length, 0);
    assert.equal(result.score, 0);
  });

  test("same address, price, and bedroom count from a different realtor — the classic duplicate-plot pattern", () => {
    const candidate = makeCandidate({ realtorProfileId: "realtor_A" });
    const existing = makeCandidate({ id: "listing_1", realtorProfileId: "realtor_B" });
    const result = detectDuplicateSignals(candidate, [existing]);

    assert.equal(result.signals.some((s) => s.kind === "same_address_and_price"), true);
    assert.equal(result.matchedListingIds.includes("listing_1"), true);
    assert.ok(result.score >= DUPLICATE_REVIEW_THRESHOLD, "cross-realtor duplicate should clear the review threshold");
  });

  test("same address/price from the SAME realtor is weighted lower than cross-realtor", () => {
    const candidate = makeCandidate({ realtorProfileId: "realtor_A" });
    const sameRealtorExisting = makeCandidate({ id: "listing_1", realtorProfileId: "realtor_A" });
    const crossRealtorExisting = makeCandidate({ id: "listing_2", realtorProfileId: "realtor_B" });

    const sameRealtorResult = detectDuplicateSignals(candidate, [sameRealtorExisting]);
    const crossRealtorResult = detectDuplicateSignals(candidate, [crossRealtorExisting]);

    assert.ok(sameRealtorResult.score < crossRealtorResult.score);
  });

  test("same address and price but different type — the listing-hijacking pattern", () => {
    const candidate = makeCandidate({ type: "RENT" });
    const existing = makeCandidate({ id: "listing_1", type: "SALE" });
    const result = detectDuplicateSignals(candidate, [existing]);

    assert.equal(result.signals.some((s) => s.kind === "same_address_cross_type"), true);
    assert.ok(result.score >= DUPLICATE_REVIEW_THRESHOLD);
  });

  test("reused phone number across different realtor accounts", () => {
    const candidate = makeCandidate({ realtorProfileId: "realtor_A", realtorPhone: "+2348010000099", area: "Guzape" });
    const existing = makeCandidate({ id: "listing_1", realtorProfileId: "realtor_B", realtorPhone: "+2348010000099", area: "Jabi" });
    const result = detectDuplicateSignals(candidate, [existing]);

    assert.equal(result.signals.some((s) => s.kind === "reused_phone_different_realtor"), true);
  });

  test("matching image hashes flags regardless of address/price", () => {
    const candidate = makeCandidate({ area: "Gwarinpa", photoHashes: ["hash_abc", "hash_def"] });
    const existing = makeCandidate({ id: "listing_1", area: "Life Camp", photoHashes: ["hash_xyz", "hash_abc"] });
    const result = detectDuplicateSignals(candidate, [existing]);

    const match = result.signals.find((s) => s.kind === "matching_image_hash");
    assert.ok(match);
    assert.match(match!.detail, /1 photo/);
  });

  test("perceptually similar 64-bit image hashes flag resized or recompressed copies", () => {
    const candidate = makeCandidate({ area: "Gwarinpa", photoHashes: ["0000000000000000"] });
    const existing = makeCandidate({ id: "listing_hash", area: "Life Camp", photoHashes: ["000000000000001f"] });
    const result = detectDuplicateSignals(candidate, [existing]);
    assert.equal(result.signals.some((s) => s.kind === "matching_image_hash"), true);
    assert.ok(result.score >= DUPLICATE_REVIEW_THRESHOLD);
  });

  test("different perceptual image hashes do not flag a match", () => {
    const candidate = makeCandidate({ area: "Gwarinpa", photoHashes: ["0000000000000000"] });
    const existing = makeCandidate({ id: "listing_hash", area: "Life Camp", photoHashes: ["ffffffffffffffff"] });
    const result = detectDuplicateSignals(candidate, [existing]);
    assert.equal(result.signals.some((s) => s.kind === "matching_image_hash"), false);
  });

  test("similar title at a different address is a weak signal, not a strong one", () => {
    const candidate = makeCandidate({ area: "Asokoro", title: "3 Bedroom Duplex in Maitama with garden and parking" });
    const existing = makeCandidate({ id: "listing_1", area: "Katampe", title: "3 Bedroom Duplex in Maitama with garden" });
    const result = detectDuplicateSignals(candidate, [existing]);

    const match = result.signals.find((s) => s.kind === "similar_title");
    assert.ok(match);
    assert.ok(match!.weight < DUPLICATE_REVIEW_THRESHOLD, "a single title-similarity signal alone shouldn't clear the review threshold");
  });

  test("a listing never matches itself when its own id is passed", () => {
    const candidate = makeCandidate({ id: "listing_1" });
    const result = detectDuplicateSignals(candidate, [candidate]);
    assert.equal(result.signals.length, 0);
  });

  test("score accumulates across multiple matched listings", () => {
    const candidate = makeCandidate({ realtorProfileId: "realtor_A" });
    const result = detectDuplicateSignals(candidate, [
      makeCandidate({ id: "listing_1", realtorProfileId: "realtor_B" }),
      makeCandidate({ id: "listing_2", realtorProfileId: "realtor_C" }),
    ]);
    assert.equal(result.matchedListingIds.length, 2);
    assert.ok(result.score > 35); // more than a single cross-realtor match alone
  });
});
