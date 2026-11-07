import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateCommissionNaira, isWithinFreeOnboardingWindow, COMMISSION_RATE_BPS } from "../../src/commission";

describe("calculateCommissionNaira", () => {
  test("computes 10% of the agreed price at the default rate", () => {
    assert.equal(calculateCommissionNaira(100_000n), 10_000n);
  });

  test("rounds down to the nearest naira", () => {
    // 999 naira at 10% = 99.9 -> should floor to 99, never round up
    assert.equal(calculateCommissionNaira(999n), 99n);
  });

  test("returns 0 for a zero price", () => {
    assert.equal(calculateCommissionNaira(0n), 0n);
  });

  test("returns 0 for a negative price rather than throwing", () => {
    assert.equal(calculateCommissionNaira(-500n), 0n);
  });

  test("respects a custom rate override", () => {
    assert.equal(calculateCommissionNaira(100_000n, 500), 5_000n); // 5%
  });

  test("returns 0 when the override rate is non-positive", () => {
    assert.equal(calculateCommissionNaira(100_000n, 0), 0n);
  });

  test("default rate constant is 10% (1000 bps) as decided for launch", () => {
    assert.equal(COMMISSION_RATE_BPS, 1000);
  });
});

describe("isWithinFreeOnboardingWindow", () => {
  test("true when freeUntil is in the future", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const freeUntil = new Date("2026-02-01T00:00:00Z");
    assert.equal(isWithinFreeOnboardingWindow(freeUntil, now), true);
  });

  test("false when freeUntil is in the past", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const freeUntil = new Date("2026-02-01T00:00:00Z");
    assert.equal(isWithinFreeOnboardingWindow(freeUntil, now), false);
  });

  test("false when freeUntil is null (never granted a grace period)", () => {
    assert.equal(isWithinFreeOnboardingWindow(null), false);
  });

  test("false at the exact boundary instant (not inclusive)", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    assert.equal(isWithinFreeOnboardingWindow(now, now), false);
  });
});
