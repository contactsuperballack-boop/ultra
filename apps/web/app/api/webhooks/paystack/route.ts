import { NextRequest, NextResponse } from "next/server";
import { db } from "@ultra/db";
import { verifyWebhookSignature, reportError } from "@ultra/api";

/**
 * Paystack is the authority for payment confirmation. We additionally match
 * the signed event's currency and kobo amount to our pending ledger record.
 * Conditional status transition inside the same DB transaction makes webhook
 * retries/concurrent deliveries idempotent for all balance mutations.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyWebhookSignature(rawBody, req.headers.get("x-paystack-signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const reference = event?.data?.reference;
    if (typeof reference !== "string" || !reference) {
      return NextResponse.json({ received: true, ignored: true });
    }

    if (event.event === "charge.failed") {
      await db.paymentTransaction.updateMany({
        where: { providerRef: reference, status: "PENDING" },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ received: true });
    }
    if (event.event !== "charge.success") return NextResponse.json({ received: true });

    const transaction = await db.paymentTransaction.findUnique({ where: { providerRef: reference } });
    if (!transaction) {
      console.error(`[paystack webhook] Unknown reference: ${reference}`);
      return NextResponse.json({ received: true, unknownReference: true });
    }
    if (transaction.status !== "PENDING") {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const expectedKobo = Number(transaction.amountNaira) * 100;
    if (event.data.currency !== "NGN" || !Number.isSafeInteger(event.data.amount) || event.data.amount !== expectedKobo) {
      console.error(`[paystack webhook] Amount/currency mismatch for ${reference}; expected NGN ${expectedKobo} kobo, received ${event.data.currency} ${event.data.amount}`);
      await db.paymentTransaction.updateMany({
        where: { id: transaction.id, status: "PENDING" },
        data: { status: "FAILED", note: "Paystack event amount/currency did not match the pending transaction." },
      });
      return NextResponse.json({ received: true, rejected: true });
    }

    await db.$transaction(async (tx) => {
      // Only one delivery can claim a pending transaction. Any later delivery
      // sees count=0 and performs no financial mutation.
      const claimed = await tx.paymentTransaction.updateMany({
        where: { id: transaction.id, status: "PENDING" },
        data: { status: "SUCCESS" },
      });
      if (claimed.count !== 1) return;

      if (transaction.providerProfileId) {
        if (transaction.type === "SUBSCRIPTION") {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          await tx.providerProfile.update({
            where: { id: transaction.providerProfileId },
            data: { subscriptionTier: "PREMIUM", subscriptionExpiresAt: expiresAt },
          });
        } else if (transaction.type === "COMMISSION_SETTLEMENT") {
          const reduced = await tx.providerProfile.updateMany({
            where: { id: transaction.providerProfileId, commissionOwedNaira: { gte: transaction.amountNaira } },
            data: { commissionOwedNaira: { decrement: transaction.amountNaira } },
          });
          if (reduced.count !== 1) throw new Error(`Commission settlement exceeds outstanding balance for ${reference}`);
        }
      } else if (transaction.realtorProfileId) {
        if (transaction.type === "SUBSCRIPTION") {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          await tx.realtorProfile.update({
            where: { id: transaction.realtorProfileId },
            data: { subscriptionTier: "PREMIUM", subscriptionExpiresAt: expiresAt },
          });
        } else if (transaction.type === "TOPUP") {
          await tx.realtorProfile.update({
            where: { id: transaction.realtorProfileId },
            data: { creditBalanceNaira: { increment: transaction.amountNaira } },
          });
        } else {
          throw new Error(`Unsupported realtor payment transaction type ${transaction.type}`);
        }
      } else {
        throw new Error(`Payment transaction ${reference} has no account owner`);
      }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    reportError(error, { route: "/api/webhooks/paystack", event: "webhook_processing_failed" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
