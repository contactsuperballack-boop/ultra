import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.PAYSTACK_SECRET_KEY = "sk_test_fake_key_for_unit_tests_only";

import { verifyWebhookSignature } from "../../src/lib/paystack";

function validSignatureFor(body: string): string {
  return createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  test("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "abc123" } });
    const signature = validSignatureFor(body);
    assert.equal(verifyWebhookSignature(body, signature), true);
  });

  test("rejects a payload with no signature header", () => {
    const body = JSON.stringify({ event: "charge.success" });
    assert.equal(verifyWebhookSignature(body, null), false);
  });

  test("rejects a payload with an incorrect signature", () => {
    const body = JSON.stringify({ event: "charge.success" });
    assert.equal(verifyWebhookSignature(body, "0".repeat(128)), false);
  });

  test("rejects when the body was tampered with after signing (e.g. amount modified)", () => {
    // This is the actual attack this function exists to prevent: someone
    // intercepts a real webhook, changes the amount, and replays it.
    const originalBody = JSON.stringify({ event: "charge.success", data: { amount: 50000 } });
    const signature = validSignatureFor(originalBody);
    const tamperedBody = JSON.stringify({ event: "charge.success", data: { amount: 5000000 } });
    assert.equal(verifyWebhookSignature(tamperedBody, signature), false);
  });

  test("a signature valid for one payload is not valid for a different payload", () => {
    const bodyA = JSON.stringify({ reference: "ref_a" });
    const bodyB = JSON.stringify({ reference: "ref_b" });
    const signatureForA = validSignatureFor(bodyA);
    assert.equal(verifyWebhookSignature(bodyB, signatureForA), false);
  });
});
