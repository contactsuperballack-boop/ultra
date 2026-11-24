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



  test("bulk requests must be installation projects with a named site", async () => {
    const { user: providerUser } = await createAuthedCaller({ role: "PROVIDER", phone: "+2348030000098", provider: { businessName: "Bulk Solar Provider", categories: ["SOLAR"] } });
    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348030000099" });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    await expect(customerCaller.serviceRequests.create({ providerProfileId: providerProfile.id, category: "SOLAR", unitCount: 12, note: "Install solar in twelve apartments in the estate." })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(customerCaller.serviceRequests.create({ providerProfileId: providerProfile.id, category: "SOLAR", transactionType: "INSTALLATION_PROJECT", unitCount: 12, note: "Install solar in twelve apartments in the estate." })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("one-time requests capture a preferred appointment and provider-confirmed schedule", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({ role: "PROVIDER", phone: "+2348030000201", provider: { businessName: "Quick Plumbing", categories: ["PLUMBING"] } });
    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348030000202" });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    const preferredAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const request = await customerCaller.serviceRequests.create({
      providerProfileId: providerProfile.id, category: "PLUMBING", siteAddress: "Wuse 2, Abuja",
      preferredAt: preferredAt.toISOString(), note: "Repair a leaking kitchen pipe and inspect the water pressure.",
    });
    expect(request.preferredAt?.toISOString()).toBe(preferredAt.toISOString());
    await expect(customerCaller.serviceRequests.create({
      providerProfileId: providerProfile.id, category: "PLUMBING", preferredAt: new Date(Date.now() - 60_000).toISOString(),
      note: "Repair a leaking kitchen pipe and inspect the water pressure.",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await expect(providerCaller.serviceRequests.respond({ serviceRequestId: request.id, status: "ACCEPTED", agreedPriceNaira: 25_000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const accepted = await providerCaller.serviceRequests.respond({ serviceRequestId: request.id, status: "ACCEPTED", agreedPriceNaira: 25_000, scheduledAt: scheduledAt.toISOString() });
    expect(accepted.scheduledAt?.toISOString()).toBe(scheduledAt.toISOString());
    await expect(providerCaller.serviceRequests.respond({ serviceRequestId: request.id, status: "ACCEPTED", agreedPriceNaira: 25_000, scheduledAt: new Date(Date.now() - 60_000).toISOString() })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("installation project requests require a reconciled quote and customer-approved milestones before completion", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({ role: "PROVIDER", phone: "+2348030000101", provider: { businessName: "Greenview Solar Works", categories: ["SOLAR"] } });
    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348030000102" });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    const request = await customerCaller.serviceRequests.create({
      providerProfileId: providerProfile.id, category: "SOLAR", transactionType: "INSTALLATION_PROJECT",
      unitCount: 24, siteName: "Greenview Estate", siteAddress: "Jabi, Abuja",
      note: "Solar and inverter installation for twenty-four residential units at the estate.",
    });
    expect(request.transactionType).toBe("INSTALLATION_PROJECT");
    expect(request.unitCount).toBe(24);
    await expect(providerCaller.serviceRequests.respond({ serviceRequestId: request.id, status: "ACCEPTED", agreedPriceNaira: 1_000_000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const declined = await providerCaller.serviceRequests.respond({ serviceRequestId: request.id, status: "DECLINED" });
    expect(declined.status).toBe("DECLINED");

    const reopened = await customerCaller.serviceRequests.create({
      providerProfileId: providerProfile.id, category: "SOLAR", transactionType: "INSTALLATION_PROJECT",
      unitCount: 24, siteName: "Greenview Estate", siteAddress: "Jabi, Abuja",
      note: "Solar and inverter installation for twenty-four residential units at the estate, please quote again.",
    });

    await expect(providerCaller.serviceRequests.proposeQuote({
      serviceRequestId: reopened.id, scopeSummary: "Supply, install, test and hand over solar systems for the estate.",
      totalPriceNaira: 1_000_000, estimatedDurationDays: 30,
      milestones: [{ title: "Mobilisation", amountNaira: 400_000 }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const quote = await providerCaller.serviceRequests.proposeQuote({
      serviceRequestId: reopened.id, scopeSummary: "Supply, install, test and hand over solar systems for the estate." ,
      totalPriceNaira: 1_000_000, estimatedDurationDays: 30,
      milestones: [{ title: "Equipment and mobilisation", amountNaira: 400_000 }, { title: "Installation and handover", amountNaira: 600_000 }],
    });
    expect(quote.milestones).toHaveLength(2);
    expect((await customerCaller.serviceRequests.myRequests()).find((item) => item.id === reopened.id)?.status).toBe("PROPOSAL_PENDING");

    const accepted = await customerCaller.serviceRequests.acceptProposal({ serviceRequestId: reopened.id });
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.agreedPriceNaira).toBe(1_000_000n);
    await expect(providerCaller.serviceRequests.complete({ serviceRequestId: reopened.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    for (const milestone of quote.milestones) {
      await providerCaller.serviceRequests.updateMilestone({ milestoneId: milestone.id, status: "IN_PROGRESS" });
      await providerCaller.serviceRequests.updateMilestone({ milestoneId: milestone.id, status: "COMPLETED" });
      await customerCaller.serviceRequests.approveMilestone({ milestoneId: milestone.id });
    }
    const completed = await providerCaller.serviceRequests.complete({ serviceRequestId: reopened.id });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.commissionNaira).toBe(100_000n);
  });

  test("recurring service agreement is accepted by the customer and commission accrues per completed visit", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({ role: "PROVIDER", phone: "+2348030000111", provider: { businessName: "Estate Cleaning Partners", categories: ["CLEANING"] } });
    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348030000112" });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    const request = await customerCaller.serviceRequests.create({
      providerProfileId: providerProfile.id, category: "CLEANING", transactionType: "RECURRING",
      requestedFrequency: "MONTHLY", note: "Monthly cleaning for the shared spaces and corridors of our estate.",
    });
    const startAt = new Date(Date.now() + 86_400_000);
    const agreement = await providerCaller.serviceRequests.proposeAgreement({
      serviceRequestId: request.id, serviceScope: "Monthly cleaning of estate corridors, lobby, shared washrooms and common spaces.",
      frequency: "MONTHLY", pricePerVisitNaira: 50_000, startAt: startAt.toISOString(),
    });
    expect(agreement.status).toBe("PROPOSED");
    await expect(providerCaller.serviceRequests.respond({ serviceRequestId: request.id, status: "ACCEPTED", agreedPriceNaira: 50_000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await customerCaller.serviceRequests.acceptProposal({ serviceRequestId: request.id });
    const activeAgreement = await db.recurringAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect(activeAgreement.status).toBe("ACTIVE");

    const occurrence = await providerCaller.serviceRequests.scheduleOccurrence({ agreementId: agreement.id, scheduledAt: startAt.toISOString() });
    await providerCaller.serviceRequests.startOccurrence({ occurrenceId: occurrence.id });
    const completed = await providerCaller.serviceRequests.completeOccurrence({ occurrenceId: occurrence.id });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.commissionNaira).toBe(5_000n);
    expect(completed.commissionBilled).toBe(true);

    const ledger = await db.paymentTransaction.findFirst({ where: { serviceOccurrenceId: occurrence.id, type: "COMMISSION" } });
    expect(ledger?.amountNaira).toBe(5_000n);
    expect(ledger?.status).toBe("SUCCESS");

    const refreshedAgreement = await db.recurringAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect(refreshedAgreement.nextServiceAt.getTime()).toBeGreaterThan(startAt.getTime());
    const nextOccurrence = await providerCaller.serviceRequests.scheduleOccurrence({ agreementId: agreement.id, scheduledAt: refreshedAgreement.nextServiceAt.toISOString() });
    await customerCaller.serviceRequests.cancelAgreement({ agreementId: agreement.id });
    expect((await db.recurringAgreement.findUniqueOrThrow({ where: { id: agreement.id } })).status).toBe("CANCELLED");
    expect((await db.serviceOccurrence.findUniqueOrThrow({ where: { id: nextOccurrence.id } })).status).toBe("CANCELLED");
  });

  test("service request operations list is admin-only and paginated", async () => {
    const { caller: buyer } = await createAuthedCaller({ role: "BUYER", phone: "+2348030000091" });
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348030000092" });
    await expect(buyer.serviceRequests.adminList({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    const result = await admin.serviceRequests.adminList({ limit: 10 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("nextCursor");
  });
});
