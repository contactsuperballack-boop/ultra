import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

// tokens.ts reads JWT_SECRET at call time (not module load time), so
// setting it here before any import that might cache it is sufficient —
// but to be safe or resilient to future refactors, we still set it before
// the first call in every test rather than assuming module load order.
process.env.JWT_SECRET = "test-secret-do-not-use-in-production";

import { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken } from "../../src/lib/tokens";

describe("signAccessToken / verifyAccessToken", () => {
  test("a signed token verifies back to the same payload", () => {
    const token = signAccessToken({ sub: "user_123", role: "BUYER" });
    const payload = verifyAccessToken(token);
    assert.equal(payload?.sub, "user_123");
    assert.equal(payload?.role, "BUYER");
  });

  test("a tampered token fails verification", () => {
    const token = signAccessToken({ sub: "user_123", role: "BUYER" });
    const tampered = token.slice(0, -3) + "xyz";
    assert.equal(verifyAccessToken(tampered), null);
  });

  test("a garbage string is not a valid token", () => {
    assert.equal(verifyAccessToken("not.a.jwt"), null);
  });

  test("throws a clear error if JWT_SECRET is unset — never signs with an empty/default secret", () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    assert.throws(() => signAccessToken({ sub: "user_123", role: "BUYER" }), /JWT_SECRET is not set/);
    process.env.JWT_SECRET = original;
  });
});

describe("generateRefreshToken", () => {
  test("returns a raw token whose hash matches hashToken(raw)", () => {
    const { raw, hash } = generateRefreshToken();
    assert.equal(hashToken(raw), hash);
  });

  test("raw token is never equal to its own hash", () => {
    const { raw, hash } = generateRefreshToken();
    assert.notEqual(raw, hash);
  });

  test("expiresAt is in the future", () => {
    const { expiresAt } = generateRefreshToken();
    assert.ok(expiresAt.getTime() > Date.now());
  });

  test("two calls produce different raw tokens (not deterministic/reused)", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    assert.notEqual(a.raw, b.raw);
  });
});
