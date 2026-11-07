import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

async function createAcceptedRequest(opts: { agreedPriceNaira?: number } = {}) {
  const { caller: providerCaller, user: providerUser } = await createAuthedCaller({
    role: "PROVIDER",
    phone: "+2348030000001",
    provider: { businessName: "Race Condition Plumbing", categories: ["PLUMBING"] },
  });
  const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348030000002" });

  const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });

  const request = await customerCaller.serviceRequests.create({
    providerProfileId: providerProfile.id,
    category: "PLUMBING",
    note: "Leaking kitchen pipe, needs a callout this week.",
  });

  await providerCaller.serviceRequests.respond({
    serviceRequestId: request.id,
    status: "ACCEPTED",
    agreedPriceNaira: opts.agreedPriceNaira ?? 20_000,
  });

  return { providerCaller, providerProfile, request };
}

describe("serviceRequests.complete — commission accrual (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("completing an accepted request accrues 10% commission and creates a SUCCESS ledger entry", async () => {
    const { providerCaller, providerProfile, request } = await createAcceptedRequest({ agreedPriceNaira: 20_000 });

    const completed = await providerCaller.serviceRequests.complete({ serviceRequestId: request.id });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.commissionNaira).toBe(2_000n); // 10% of 20,000

    const profile = await db.providerProfile.findUniqueOrThrow({ where: { id: providerProfile.id } });
    expect(profile.commissionOwedNaira).toBe(2_000n);

    const tx = await db.paymentTransaction.findFirst({ where: { providerProfileId: providerProfile.id, type: "COMMISSION" } });
    expect(tx?.status).toBe("SUCCESS");
    expect(tx?.amountNaira).toBe(2_000n);
    expect(tx?.serviceRequestId).toBe(request.id);
  });

  test("finalPriceNaira overrides the agreed price and commission is computed against the final figure", async () => {
    const { providerCaller, request } = await createAcceptedRequest({ agreedPriceNaira: 20_000 });

    const completed = await providerCaller.serviceRequests.complete({ serviceRequestId: request.id, finalPriceNaira: 30_000 });
    expect(completed.agreedPriceNaira).toBe(30_000n);
    expect(completed.commissionNaira).toBe(3_000n);
  });

  // The actual point of this file — Sprint 1's race-condition fix.
  // Fires two `complete()` calls concurrently for the same request and
  // asserts exactly one succeeds and exactly one commission entry exists,
  // never two. Before the fix (a plain `.update()` after a pre-check
  // outside the transaction), both calls could pass the pre-check before
  // either committed, double-billing the provider — this test exists
  // specifically to catch a regression back to that shape, not just to
  // exercise the happy path again.
  test("two concurrent complete() calls for the same request only bill commission once", async () => {
    const { providerCaller, providerProfile, request } = await createAcceptedRequest({ agreedPriceNaira: 20_000 });

    const results = await Promise.allSettled([
      providerCaller.serviceRequests.complete({ serviceRequestId: request.id }),
      providerCaller.serviceRequests.complete({ serviceRequestId: request.id }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    // @ts-expect-error — narrowed by the length assertion above
    expect(rejected[0].reason?.code).toBe("CONFLICT");

    const profile = await db.providerProfile.findUniqueOrThrow({ where: { id: providerProfile.id } });
    expect(profile.commissionOwedNaira).toBe(2_000n); // not 4_000n — the bug this test guards against

    const commissionEntries = await db.paymentTransaction.findMany({ where: { providerProfileId: providerProfile.id, type: "COMMISSION" } });
    expect(commissionEntries.length).toBe(1);
  });

  test("completing an already-completed request is rejected, not silently re-billed", async () => {
    const { providerCaller, request } = await createAcceptedRequest();
    await providerCaller.serviceRequests.complete({ serviceRequestId: request.id });

    await expect(providerCaller.serviceRequests.complete({ serviceRequestId: request.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("a provider cannot complete a request that isn't theirs", async () => {
    const { request } = await createAcceptedRequest();
    const { caller: otherProviderCaller } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348030000003",
      provider: { businessName: "Unrelated Electricals", categories: ["ELECTRICAL"] },
    });

    await expect(otherProviderCaller.serviceRequests.complete({ serviceRequestId: request.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
