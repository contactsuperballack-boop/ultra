import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateOtpCode, hashOtpCode, OTP_LENGTH, getSmsProvider, TermiiSmsProvider, DevConsoleSmsProvider } from "../../src/lib/otp";

describe("generateOtpCode", () => {
  test(`generates a code of exactly ${OTP_LENGTH} digits`, () => {
    const code = generateOtpCode();
    assert.equal(code.length, OTP_LENGTH);
  });

  test("generates only numeric characters", () => {
    const code = generateOtpCode();
    assert.match(code, /^\d+$/);
  });

  test("zero-pads codes shorter than OTP_LENGTH digits", () => {
    // Run many times — randInt(0, 10^6) can produce values like 42 that
    // must come out as "000042", not "42". A single run could get lucky.
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      assert.equal(code.length, OTP_LENGTH, `Got "${code}" — not zero-padded to ${OTP_LENGTH} digits`);
    }
  });

  test("generates different codes across calls (not hardcoded)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()));
    assert.ok(codes.size > 1, "Expected variation across 20 generated codes");
  });
});

describe("hashOtpCode", () => {
  test("is deterministic — same input produces same hash", () => {
    assert.equal(hashOtpCode("123456"), hashOtpCode("123456"));
  });

  test("different codes produce different hashes", () => {
    assert.notEqual(hashOtpCode("123456"), hashOtpCode("654321"));
  });

  test("never returns the raw code itself", () => {
    const hash = hashOtpCode("123456");
    assert.notEqual(hash, "123456");
    assert.equal(hash.length, 64); // sha256 hex digest length
  });
});

describe("getSmsProvider — production hardening", () => {
  // Snapshot and restore env vars around each test so they don't leak
  // between tests or affect other test files run in the same process.
  const originalKey = process.env.TERMII_API_KEY;
  const originalEnv = process.env.NODE_ENV;
  function restore() {
    if (originalKey === undefined) delete process.env.TERMII_API_KEY; else process.env.TERMII_API_KEY = originalKey;
    process.env.NODE_ENV = originalEnv;
  }

  test("returns TermiiSmsProvider when TERMII_API_KEY is set", () => {
    process.env.TERMII_API_KEY = "test-key";
    assert.ok(getSmsProvider() instanceof TermiiSmsProvider);
    restore();
  });

  test("returns DevConsoleSmsProvider when unset and not in production", () => {
    delete process.env.TERMII_API_KEY;
    process.env.NODE_ENV = "development";
    assert.ok(getSmsProvider() instanceof DevConsoleSmsProvider);
    restore();
  });

  test("throws — does NOT fall back to console logging — when unset in production", () => {
    delete process.env.TERMII_API_KEY;
    process.env.NODE_ENV = "production";
    assert.throws(() => getSmsProvider(), /Refusing to fall back to logging OTP codes/);
    restore();
  });
});
