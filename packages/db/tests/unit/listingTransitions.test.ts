import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isValidListingTransition } from "../../src/listingTransitions";

describe("isValidListingTransition — realtor", () => {
  test("realtor CANNOT set their own listing to LIVE from anywhere — this is the bug this matrix exists to close", () => {
    const froms = ["DRAFT", "PENDING_REVIEW", "UNDER_REVIEW", "SOLD", "RENTED", "REMOVED"] as const;
    for (const from of froms) {
      assert.equal(isValidListingTransition("realtor", from, "LIVE"), false, `realtor ${from} -> LIVE should be rejected`);
    }
  });

  test("realtor can pause a LIVE listing to DRAFT", () => {
    assert.equal(isValidListingTransition("realtor", "LIVE", "DRAFT"), true);
  });

  test("realtor can mark a LIVE listing SOLD or RENTED", () => {
    assert.equal(isValidListingTransition("realtor", "LIVE", "SOLD"), true);
    assert.equal(isValidListingTransition("realtor", "LIVE", "RENTED"), true);
  });

  test("realtor can resubmit a DRAFT/SOLD/RENTED listing for review", () => {
    assert.equal(isValidListingTransition("realtor", "DRAFT", "PENDING_REVIEW"), true);
    assert.equal(isValidListingTransition("realtor", "SOLD", "PENDING_REVIEW"), true);
    assert.equal(isValidListingTransition("realtor", "RENTED", "PENDING_REVIEW"), true);
  });

  test("realtor cannot touch a REMOVED listing at all", () => {
    assert.equal(isValidListingTransition("realtor", "REMOVED", "DRAFT"), false);
    assert.equal(isValidListingTransition("realtor", "REMOVED", "PENDING_REVIEW"), false);
  });

  test("realtor cannot set REMOVED on their own listing", () => {
    assert.equal(isValidListingTransition("realtor", "LIVE", "REMOVED"), false);
    assert.equal(isValidListingTransition("realtor", "DRAFT", "REMOVED"), false);
  });
});

describe("isValidListingTransition — admin", () => {
  test("admin can approve PENDING_REVIEW or UNDER_REVIEW to LIVE", () => {
    assert.equal(isValidListingTransition("admin", "PENDING_REVIEW", "LIVE"), true);
    assert.equal(isValidListingTransition("admin", "UNDER_REVIEW", "LIVE"), true);
  });

  test("admin cannot approve an already-terminal listing (SOLD/RENTED/REMOVED) straight to LIVE", () => {
    assert.equal(isValidListingTransition("admin", "SOLD", "LIVE"), false);
    assert.equal(isValidListingTransition("admin", "RENTED", "LIVE"), false);
    assert.equal(isValidListingTransition("admin", "REMOVED", "LIVE"), false);
  });

  test("admin can remove from any non-removed state", () => {
    const froms = ["DRAFT", "PENDING_REVIEW", "LIVE", "UNDER_REVIEW", "SOLD", "RENTED"] as const;
    for (const from of froms) {
      assert.equal(isValidListingTransition("admin", from, "REMOVED"), true, `admin ${from} -> REMOVED should be allowed`);
    }
  });

  test("REMOVED is terminal even for an admin through this transition set", () => {
    assert.equal(isValidListingTransition("admin", "REMOVED", "LIVE"), false);
    assert.equal(isValidListingTransition("admin", "REMOVED", "PENDING_REVIEW"), false);
  });
});
