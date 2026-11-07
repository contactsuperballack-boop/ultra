import { NextRequest, NextResponse } from "next/server";
import { db } from "@ultra/db";
import { verifyWebhookSignature } from "@ultra/api";

/**
 * This is the ONLY code path that ever sets a PaymentTransaction to SUCCESS
 * and credits a realtor's balance — never the frontend, never the
 * initiateTopUp mutation itself, per framework §18: "never mark an order
 * paid solely because the frontend says payment succeeded."
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    // Deliberately vague response — don't tell an attacker whether the
    // signature or the payload was the problem.
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const reference = event.data.reference as string;

    const transaction = await db.paymentTransaction.findUnique({ where: { providerRef: reference } });
    if (!transaction) {
      // Reference we don't recognize — log and 200 anyway so Paystack
      // doesn't retry indefinitely for an event that will never resolve.
      console.error(`[paystack webhook] Unknown reference: ${reference}`);
      return NextResponse.json({ received: true });
    }

    // Idempotency: webhooks can and do arrive more than once for the same
    // event. If this transaction is already SUCCESS, skip re-crediting —
    // otherwise a retried webhook would double the realtor's balance or
    // extend a subscription twice for one payment.
    if (transaction.status === "SUCCESS") {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Phase 2 note: exactly one of realtorProfileId / providerProfileId is
    // set per transaction (see PaymentTransaction's schema comment) — this
    // branches on which side of the marketplace the payment belongs to
    // before branching again on transaction type, so the SUBSCRIPTION
    // logic below is genuinely shared between realtors and providers
    // rather than duplicated.
    if (transaction.providerProfileId) {
      if (transaction.type === "SUBSCRIPTION") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await db.$transaction([
          db.paymentTransaction.update({ where: { id: transaction.id }, data: { status: "SUCCESS" } }),
          db.providerProfile.update({
            where: { id: transaction.providerProfileId },
            data: { subscriptionTier: "PREMIUM", subscriptionExpiresAt: expiresAt },
          }),
        ]);
      } else if (transaction.type === "COMMISSION_SETTLEMENT") {
        // Inverse of TOPUP: this DECREMENTS what's owed rather than
        // crediting a spendable balance. Capped at 0 rather than going
        // negative, same defensive floor adminIssueRefund applies to a
        // realtor's balance — an overpayment here shouldn't leave the
        // provider with a negative "owed" figure.
        const profile = await db.providerProfile.findUniqueOrThrow({ where: { id: transaction.providerProfileId } });
        const applied = transaction.amountNaira > profile.commissionOwedNaira ? profile.commissionOwedNaira : transaction.amountNaira;
        await db.$transaction([
          db.paymentTransaction.update({ where: { id: transaction.id }, data: { status: "SUCCESS" } }),
          db.providerProfile.update({
            where: { id: transaction.providerProfileId },
            data: { commissionOwedNaira: { decrement: applied } },
          }),
        ]);
      }
    } else if (transaction.realtorProfileId) {
      if (transaction.type === "SUBSCRIPTION") {
        // Extends from *now*, not from any prior expiry — a realtor renewing
        // after their subscription already lapsed shouldn't have the new
        // 30 days silently backdated to when the old one ran out.
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await db.$transaction([
          db.paymentTransaction.update({ where: { id: transaction.id }, data: { status: "SUCCESS" } }),
          db.realtorProfile.update({
            where: { id: transaction.realtorProfileId },
            data: { subscriptionTier: "PREMIUM", subscriptionExpiresAt: expiresAt },
          }),
        ]);
      } else {
        // TOPUP (and any future non-subscription credit type)
        await db.$transaction([
          db.paymentTransaction.update({ where: { id: transaction.id }, data: { status: "SUCCESS" } }),
          db.realtorProfile.update({
            where: { id: transaction.realtorProfileId },
            data: { creditBalanceNaira: { increment: transaction.amountNaira } },
          }),
        ]);
      }
    }
  }

  if (event.event === "charge.failed") {
    const reference = event.data.reference as string;
    await db.paymentTransaction.updateMany({
      where: { providerRef: reference, status: "PENDING" },
      data: { status: "FAILED" },
    });
  }

  return NextResponse.json({ received: true });
}
