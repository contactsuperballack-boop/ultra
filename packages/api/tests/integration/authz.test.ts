import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

/**
 * Execution Plan, Sprint 4: "the most serious marketplace security failures
 * usually come from users accessing another user's listing, message,
 * payment, or verification record." This file exists to make that a
 * written, explicit pass/fail rather than an assertion buried inside a
 * feature test that happens to also check ownership in passing.
 *
 * Structurally reviewed against the actual routers, not executed — same
 * disclosure as every other integration test in this suite (no Postgres
 * in the environment this was written in).
 */
describe("ownership and role boundaries (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("a buyer cannot read another buyer's inquiry thread", async () => {
    const { caller: realtorCaller } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348050000001", realtor: { agencyName: "Boundary Test Realty", creditBalanceNaira: 10_000n },
    });
    const { listing } = await realtorCaller.listings.create({
      title: "Boundary Test Listing", description: "A listing created only to test cross-buyer access boundaries, long enough to pass validation.",
      type: "SALE", priceNaira: 500_000_000, area: "Maitama", sizeSqm: 1000, photos: [{ url: "https://example.com/a.jpg" }],
    });
    await db.listing.update({ where: { id: listing.id }, data: { status: "LIVE", publishedAt: new Date() } });

    const { caller: buyerA } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000002" });
    const inquiry = await buyerA.inquiries.create({ listingId: listing.id, message: "Is this still available for viewing?" });

    const { caller: buyerB } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000003" });
    await expect(buyerB.inquiries.byId({ id: inquiry.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("a customer cannot read another customer's service request", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({
      role: "PROVIDER", phone: "+2348050000004", provider: { businessName: "Boundary Test Plumbing", categories: ["PLUMBING"] },
    });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });

    const { caller: customerA } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000005" });
    const request = await customerA.serviceRequests.create({
      providerProfileId: providerProfile.id, category: "PLUMBING", note: "Kitchen sink leaking under the cabinet.",
    });

    const { caller: customerB } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000006" });
    await expect(customerB.serviceRequests.byId({ id: request.id })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // The owning customer and the owning provider should both still be able to.
    await expect(customerA.serviceRequests.byId({ id: request.id })).resolves.toBeTruthy();
    await expect(providerCaller.serviceRequests.byId({ id: request.id })).resolves.toBeTruthy();
  });

  test("a provider cannot see another provider's incoming requests via forProvider", async () => {
    const { caller: providerA, user: userA } = await createAuthedCaller({
      role: "PROVIDER", phone: "+2348050000007", provider: { businessName: "Provider A Electricals", categories: ["ELECTRICAL"] },
    });
    const { caller: providerB } = await createAuthedCaller({
      role: "PROVIDER", phone: "+2348050000008", provider: { businessName: "Provider B Electricals", categories: ["ELECTRICAL"] },
    });
    const profileA = await db.providerProfile.findUniqueOrThrow({ where: { userId: userA.id } });

    const { caller: customer } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000009" });
    await customer.serviceRequests.create({ providerProfileId: profileA.id, category: "ELECTRICAL", note: "Need an outlet installed in the study." });

    const bQueue = await providerB.serviceRequests.forProvider();
    expect(bQueue.length).toBe(0);

    const aQueue = await providerA.serviceRequests.forProvider();
    expect(aQueue.length).toBe(1);
  });

  test("a non-admin cannot call an admin-only procedure, on either side of the marketplace", async () => {
    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000010" });

    await expect(buyerCaller.realtors.pendingApplications({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(buyerCaller.providers.pendingApplications({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      buyerCaller.payments.adminIssueRefund({ realtorProfileId: "nonexistent", amountNaira: 100, note: "test" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("an unverified provider cannot call verifiedProviderProcedure endpoints", async () => {
    const { caller } = await createAuthedCaller({ role: "PROVIDER", phone: "+2348050000011" });
    // Deliberately no `provider` option passed to createAuthedCaller — this
    // user has the PROVIDER role but no ProviderProfile at all, the same
    // state a real user would be in between registering and applying.
    await expect(caller.providers.myOfferings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.providers.dashboardSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // Added during Sprint 1 re-verification — this is the actual read-side
  // enforcement of the KYC privacy fix (Phase 1 trust boundary repair, item
  // 3 / storage.ts's private-bucket split). The write side (no public URL
  // is ever constructible) had no test either before this; both matter,
  // since a private bucket with an unguarded read endpoint is only half fixed.
  test("a non-admin cannot fetch a realtor's verification document URL", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348050000012", realtor: { agencyName: "Doc Access Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    await db.realtorProfile.update({ where: { id: realtorProfile.id }, data: { idDocumentUrl: "verification-doc/x/doc.pdf" } });

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000013" });
    await expect(
      buyerCaller.realtors.adminGetVerificationDocUrl({ realtorProfileId: realtorProfile.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // The realtor themselves — not just an unrelated buyer — also has no
    // route to their own document via this endpoint; it's admin-only, full
    // stop, not "admin or owner."
    const { caller: ownRealtorCaller } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348050000014", realtor: { agencyName: "Self Access Test Realty" },
    });
    await expect(
      ownRealtorCaller.realtors.adminGetVerificationDocUrl({ realtorProfileId: realtorProfile.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("a non-admin cannot fetch a provider's verification document URL", async () => {
    const { user: providerUser } = await createAuthedCaller({
      role: "PROVIDER", phone: "+2348050000015", provider: { businessName: "Doc Access Test Services", categories: ["PLUMBING"] },
    });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    await db.providerProfile.update({ where: { id: providerProfile.id }, data: { idDocumentUrl: "verification-doc/y/doc.pdf" } });

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348050000016" });
    await expect(
      buyerCaller.providers.adminGetVerificationDocUrl({ providerProfileId: providerProfile.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("a deactivated admin's still-valid access token is rejected on the next admin call", async () => {
    // MVP Audit P1 — "role state needs fresher revocation semantics."
    // adminProcedure previously trusted ctx.userRole straight from the JWT
    // with no DB check at all, so a deactivated (or role-demoted) admin's
    // token kept working until it naturally expired (up to 15 minutes).
    const { caller: adminCaller, user: adminUser } = await createAuthedCaller({ role: "ADMIN", phone: "+2348050000017" });

    // Confirm the token works before deactivation — otherwise this test
    // could pass for the wrong reason (e.g. a broken fixture).
    await expect(adminCaller.realtors.pendingApplications({})).resolves.toBeTruthy();

    // Simulate an operator deactivating this admin directly (the documented
    // path for handling a compromised admin account — there's no
    // admin-initiated suspension endpoint for another admin yet).
    await db.user.update({ where: { id: adminUser.id }, data: { deactivatedAt: new Date() } });

    // Same caller, same still-unexpired JWT — should now be rejected.
    await expect(adminCaller.realtors.pendingApplications({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
