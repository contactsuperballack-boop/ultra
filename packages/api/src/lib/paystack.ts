/**
 * Paystack client. Unlike the OTP SmsProvider, there is deliberately NO
 * dev-mock fallback here — a "fake success" payment path is exactly the
 * kind of thing framework §18 and Rule 10 warn against. Without
 * PAYSTACK_SECRET_KEY set, every method throws clearly instead of
 * pretending a payment went through.
 */
import { createHmac } from "node:crypto";

interface InitializeResult {
  authorizationUrl: string;
  reference: string;
}

interface VerifyResult {
  status: "success" | "failed" | "abandoned";
  reference: string;
  amountKobo: number;
}

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Payments cannot be initialized or verified without it — see .env.example."
    );
  }
  return key;
}

export async function initializeTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl?: string;
}): Promise<InitializeResult> {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountNaira * 100), // Paystack works in kobo
      reference: params.reference,
      callback_url: params.callbackUrl,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack initialize failed: ${json.message ?? res.status}`);
  }
  return { authorizationUrl: json.data.authorization_url, reference: json.data.reference };
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getSecretKey()}` },
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack verify failed: ${json.message ?? res.status}`);
  }
  return { status: json.data.status, reference: json.data.reference, amountKobo: json.data.amount };
}

/**
 * Verifies the `x-paystack-signature` header on an incoming webhook —
 * HMAC-SHA512 of the raw request body, keyed with the secret key. This is
 * the check that makes it safe to trust a webhook payload at all; without
 * it, anyone could POST a fake "payment succeeded" event.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const hash = createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");
  return hash === signatureHeader;
}
