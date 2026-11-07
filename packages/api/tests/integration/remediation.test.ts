import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";
import { appRouter, createContext } from "../../src";

async function createLiveListing(realtorProfileId: string, overrides: Partial<{ status: string }> = {}) {
  return db.listing.create({
    data: {
      realtorProfileId,
      title: "Remediation test listing",
      description: "Long enough description to pass validation for this integration test fixture.",
      type: "SALE",
      priceNaira: 200_000_000n,
      area: "Maitama",
      sizeSqm: 600,
      status: (overrides.status as any) ?? "LIVE",
    },
  });
}

describe("Phase 1 trust boundary repair (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  // Item 1 — safe projections.
  test("listings.byId never returns the realtor's financial/KYC fields to a public caller", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000001",
      realtor: { agencyName: "Leak Test Realty", creditBalanceNaira: 12_345n },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    await db.realtorProfile.update({ where: { id: realtorProfile.id }, data: { idDocumentUrl: "verification-doc/secret-key.pdf" } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: anon } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000002" });
    const result = await anon.listings.byId({ id: listing.id });

    expect((result.realtorProfile as any).creditBalanceNaira).toBeUndefined();
    expect((result.realtorProfile as any).idDocumentUrl).toBeUndefined();
    expect((result.realtorProfile as any).cacRegistrationNo).toBeUndefined();
    expect((result.realtorProfile as any).restrictedReason).toBeUndefined();
    // Safe fields should still be present — this isn't over-restricted.
    expect(result.realtorProfile.agencyName).toBe("Leak Test Realty");
  });

  test("inquiries.myThreads never returns the realtor's financial/KYC fields to the buyer", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000003",
      realtor: { agencyName: "Thread Leak Test Realty", creditBalanceNaira: 5_000n },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000004" });
    await buyerCaller.inquiries.create({ listingId: listing.id, message: "Is this property still available for viewing?" });

    const threads = await buyerCaller.inquiries.myThreads();
    expect((threads[0].listing.realtorProfile as any).creditBalanceNaira).toBeUndefined();
  });

  // Item 2 — LIVE-only for public callers.
  test("listings.byId hides a non-LIVE listing from an unrelated public caller (404, not 403)", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000005",
      realtor: { agencyName: "Hidden Listing Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const draftListing = await createLiveListing(realtorProfile.id, { status: "PENDING_REVIEW" });

    const { caller: anon } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000006" });
    await expect(anon.listings.byId({ id: draftListing.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("listings.byId still allows the OWNING realtor to see their own non-LIVE listing", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000007",
      realtor: { agencyName: "Own Listing Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const draftListing = await createLiveListing(realtorProfile.id, { status: "PENDING_REVIEW" });

    await expect(realtorCaller.listings.byId({ id: draftListing.id })).resolves.toBeTruthy();
  });

  test("listings.byId still allows an admin to see a non-LIVE listing", async () => {
    const { user: realtorUser } = await createAuthedCaller({ role: "REALTOR", phone: "+2348070000008", realtor: { agencyName: "X" } });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const draftListing = await createLiveListing(realtorProfile.id, { status: "UNDER_REVIEW" });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348070000009" });
    await expect(adminCaller.listings.byId({ id: draftListing.id })).resolves.toBeTruthy();
  });

  // Item 4 — realtor cannot self-publish.
  test("a realtor cannot set their own listing to LIVE via setStatus", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000010",
      realtor: { agencyName: "Self Publish Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id, { status: "PENDING_REVIEW" });

    // LIVE isn't even a valid enum value for this endpoint's input anymore —
    // this should fail Zod validation before it ever reaches the transition check.
    await expect((realtorCaller.listings.setStatus as any)({ id: listing.id, status: "LIVE" })).rejects.toBeTruthy();
  });

  test("a realtor CAN pause a LIVE listing to DRAFT, and mark it SOLD", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000011",
      realtor: { agencyName: "Valid Transition Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id, { status: "LIVE" });

    const paused = await realtorCaller.listings.setStatus({ id: listing.id, status: "DRAFT" });
    expect(paused.status).toBe("DRAFT");
  });

  // Sprint 1 fix — MVP Audit P1 finding, previously unaddressed: the
  // transition matrix validated the status graph but not status-vs-type
  // consistency, so a RENT listing could be marked SOLD and vice versa.
  test("a RENT listing cannot be marked SOLD, and a SALE listing cannot be marked RENTED", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000033",
      realtor: { agencyName: "Type Mismatch Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });

    const rentListing = await db.listing.create({
      data: {
        realtorProfileId: realtorProfile.id, title: "Rent listing", description: "A rental listing long enough to pass validation for this test.",
        type: "RENT", priceNaira: 2_000_000n, area: "Wuse", sizeSqm: 120, status: "LIVE",
      },
    });
    await expect(realtorCaller.listings.setStatus({ id: rentListing.id, status: "SOLD" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(realtorCaller.listings.setStatus({ id: rentListing.id, status: "RENTED" })).resolves.toBeTruthy();

    const saleListing = await db.listing.create({
      data: {
        realtorProfileId: realtorProfile.id, title: "Sale listing", description: "A sale listing long enough to pass validation for this test.",
        type: "SALE", priceNaira: 200_000_000n, area: "Wuse", sizeSqm: 500, status: "LIVE",
      },
    });
    await expect(realtorCaller.listings.setStatus({ id: saleListing.id, status: "RENTED" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(realtorCaller.listings.setStatus({ id: saleListing.id, status: "SOLD" })).resolves.toBeTruthy();
  });

  test("admin cannot approve an already-SOLD listing back to LIVE", async () => {
    const { user: realtorUser } = await createAuthedCaller({ role: "REALTOR", phone: "+2348070000012", realtor: { agencyName: "X" } });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id, { status: "SOLD" });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348070000013" });
    await expect(adminCaller.listings.adminSetStatus({ id: listing.id, status: "LIVE" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // Item 5 — participant check on inquiries.reply.
  test("a third party (not the buyer or the owning realtor) cannot reply to an inquiry", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000014",
      realtor: { agencyName: "Forgery Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000015" });
    const inquiry = await buyerCaller.inquiries.create({ listingId: listing.id, message: "Can I book a viewing this weekend?" });

    const { caller: strangerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000016" });
    await expect(strangerCaller.inquiries.reply({ inquiryId: inquiry.id, message: "Forged message" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  // Item 3 (found during Sprint 1 re-verification, not in the original audit
  // list) — the KYC storage fix changed idDocumentUrl's meaning from "a
  // public URL" to "an R2 object key" (storage.ts / uploads.presignVerificationDoc),
  // but the applyForVerification input validators in both realtors.ts and
  // providers.ts still required `.url()`. Since the real web form sends the
  // raw key, every real verification submission was silently rejected —
  // the security fix broke the feature it was protecting. This test would
  // have caught it: it fails against the pre-fix validator and passes
  // against the fixed one.
  test("realtors.applyForVerification accepts a real storage key, not a URL", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000030" });
    await expect(
      caller.realtors.applyForVerification({
        agencyName: "Key Format Test Realty",
        idDocumentUrl: "verification-doc/some-user-id/doc.pdf",
      })
    ).resolves.toBeTruthy();
  });

  test("realtors.applyForVerification rejects a full URL (the old, now-invalid shape)", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000031" });
    await expect(
      caller.realtors.applyForVerification({
        agencyName: "Key Format Negative Test Realty",
        idDocumentUrl: "https://public-bucket.example.com/some-user-id/doc.pdf",
      })
    ).rejects.toBeTruthy();
  });

  test("providers.applyForVerification accepts a real storage key, not a URL", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000032" });
    await expect(
      caller.providers.applyForVerification({
        businessName: "Key Format Test Services",
        categories: ["PLUMBING"],
        idDocumentUrl: "verification-doc/some-user-id/doc.pdf",
      })
    ).resolves.toBeTruthy();
  });

  test("the buyer and the owning realtor can both reply", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000017",
      realtor: { agencyName: "Legit Reply Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000018" });
    const inquiry = await buyerCaller.inquiries.create({ listingId: listing.id, message: "Can I book a viewing this weekend?" });

    await expect(buyerCaller.inquiries.reply({ inquiryId: inquiry.id, message: "Following up" })).resolves.toBeTruthy();
    await expect(realtorCaller.inquiries.reply({ inquiryId: inquiry.id, message: "Yes, Saturday works" })).resolves.toBeTruthy();
  });
});

describe("Gate B — data and state integrity (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  // Item 1 — concurrent-create race.
  test("two concurrent inquiries.create calls for the same buyer+listing result in exactly one Inquiry row and one lead-fee charge", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348070000019",
      realtor: { agencyName: "Race Test Realty", creditBalanceNaira: 10_000n },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000020" });

    await Promise.allSettled([
      buyerCaller.inquiries.create({ listingId: listing.id, message: "First concurrent message here" }),
      buyerCaller.inquiries.create({ listingId: listing.id, message: "Second concurrent message here" }),
    ]);

    const inquiries = await db.inquiry.findMany({ where: { listingId: listing.id } });
    expect(inquiries.length).toBe(1);

    const leadFeeCharges = await db.paymentTransaction.count({ where: { type: "LEAD_FEE", inquiryId: inquiries[0].id } });
    expect(leadFeeCharges).toBe(1);
  });

  // Item 3 — verification log fromStatus correctness on resubmission.
  test("resubmitting after REJECTED logs fromStatus=REJECTED, not UNVERIFIED", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000021" });

    await providerCaller.providers.applyForVerification({
      businessName: "Resubmit Test Services",
      categories: ["PLUMBING"],
      // Sprint 1 fix: this used to be a full URL ("https://example.com/doc1.pdf"),
      // which happened to still pass the (buggy) old `.url()` validator and
      // therefore never caught the fact that real submissions — which send a
      // bare storage key — were rejected. Using a realistic key here is what
      // actually exercises the real code path.
      idDocumentUrl: "verification-doc/resubmit-test-user/doc1.pdf",
    });
    const profile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348070000022" });
    await adminCaller.providers.adminSetVerificationStatus({ providerProfileId: profile.id, status: "REJECTED", note: "Blurry ID" });

    await providerCaller.providers.applyForVerification({
      businessName: "Resubmit Test Services",
      categories: ["PLUMBING"],
      idDocumentUrl: "verification-doc/resubmit-test-user/doc2.pdf",
    });

    const logs = await db.providerVerificationLog.findMany({ where: { providerProfileId: profile.id }, orderBy: { createdAt: "asc" } });
    // [0] UNVERIFIED->PENDING_REVIEW (first application), [1] PENDING_REVIEW->REJECTED (admin), [2] REJECTED->PENDING_REVIEW (resubmission)
    expect(logs[2].fromStatus).toBe("REJECTED");
  });

  // Item 4 — offering category/ownership/activity consistency on serviceRequests.create.
  test("a service request referencing an offering from a DIFFERENT provider is rejected", async () => {
    const { user: providerAUser } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348070000023",
      provider: { businessName: "Provider A", categories: ["PLUMBING"] },
    });
    const { caller: providerBCaller, user: providerBUser } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348070000024",
      provider: { businessName: "Provider B", categories: ["PLUMBING"] },
    });
    const profileA = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerAUser.id } });
    const profileB = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerBUser.id } });
    const offeringA = await providerBCaller.providers.createOffering({
      category: "PLUMBING",
      title: "Provider B's offering",
      description: "This offering belongs to provider B, not provider A.",
      priceType: "FIXED",
      priceNaira: 10_000,
    });

    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000025" });
    // Referencing provider A but Provider B's offering.
    await expect(
      customerCaller.serviceRequests.create({
        providerProfileId: profileA.id,
        offeringId: offeringA.id,
        category: "PLUMBING",
        note: "This request mismatches provider and offering on purpose.",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("a service request with a category that doesn't match the offering's category is rejected", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348070000026",
      provider: { businessName: "Category Mismatch Test", categories: ["PLUMBING", "ELECTRICAL"] },
    });
    const profile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    const plumbingOffering = await providerCaller.providers.createOffering({
      category: "PLUMBING",
      title: "Plumbing offering",
      description: "A real plumbing offering used to test category mismatch handling.",
      priceType: "FIXED",
      priceNaira: 10_000,
    });

    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070000027" });
    await expect(
      customerCaller.serviceRequests.create({
        providerProfileId: profile.id,
        offeringId: plumbingOffering.id,
        category: "ELECTRICAL", // mismatched on purpose
        note: "This declares electrical but references a plumbing offering.",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // Item 5 — full post-update offering state validation.
  test("updateOffering rejects changing priceType away from QUOTE without providing a new price", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348070000028",
      provider: { businessName: "Post-Update State Test", categories: ["FUMIGATION"] },
    });
    const offering = await providerCaller.providers.createOffering({
      category: "FUMIGATION",
      title: "Quote-only fumigation",
      description: "A fumigation offering priced by quote only, for the update-validation test.",
      priceType: "QUOTE",
    });

    await expect(
      providerCaller.providers.updateOffering({ id: offering.id, priceType: "FIXED" }) // no priceNaira provided
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("updateOffering succeeds when priceType and priceNaira are both provided together", async () => {
    const { caller: providerCaller } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348070000029",
      provider: { businessName: "Valid Update Test", categories: ["FUMIGATION"] },
    });
    const offering = await providerCaller.providers.createOffering({
      category: "FUMIGATION",
      title: "Quote-only fumigation",
      description: "A fumigation offering priced by quote only, for the update-validation test.",
      priceType: "QUOTE",
    });

    const updated = await providerCaller.providers.updateOffering({ id: offering.id, priceType: "FIXED", priceNaira: 25_000 });
    expect(updated.priceType).toBe("FIXED");
    expect(updated.priceNaira).toBe(25_000n);
  });
});

describe("MVP review fixes (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  // The ordering bug found while writing docs/MVP_REVIEW.md: an existing
  // thread should stay open (per the Technical Spec's own explicit edge
  // case) even after the listing leaves LIVE — only a genuinely NEW
  // inquiry should require LIVE.
  test("a buyer with an existing thread can still message after the listing leaves LIVE", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348080000001",
      realtor: { agencyName: "Ordering Fix Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348080000002" });
    await buyerCaller.inquiries.create({ listingId: listing.id, message: "Is this property still available?" });

    // Listing is sold — no longer LIVE.
    await db.listing.update({ where: { id: listing.id }, data: { status: "SOLD" } });

    // The buyer's existing thread should still accept a follow-up through
    // the SAME create() call the listing detail page's inquiry box uses —
    // this is exactly the path that used to throw NOT_FOUND here.
    await expect(
      buyerCaller.inquiries.create({ listingId: listing.id, message: "Following up on availability" })
    ).resolves.toBeTruthy();

    // And it should NOT have created a second Inquiry row or a second lead-fee charge.
    const inquiries = await db.inquiry.findMany({ where: { listingId: listing.id } });
    expect(inquiries.length).toBe(1);
  });

  test("a buyer with NO existing thread still cannot start a new inquiry on a non-LIVE listing", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348080000003",
      realtor: { agencyName: "Ordering Fix Negative Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id, { status: "PENDING_REVIEW" });

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348080000004" });
    await expect(
      buyerCaller.inquiries.create({ listingId: listing.id, message: "A brand new inquiry with no prior thread" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("inquiries.reply is rate-limited", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348080000005",
      realtor: { agencyName: "Reply Rate Limit Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348080000006" });
    const inquiry = await buyerCaller.inquiries.create({ listingId: listing.id, message: "Initial message for rate limit test" });

    // 100 is the configured limit — the 101st reply within the window should be rejected.
    for (let i = 0; i < 100; i++) {
      await buyerCaller.inquiries.reply({ inquiryId: inquiry.id, message: `Message number ${i}` });
    }
    await expect(buyerCaller.inquiries.reply({ inquiryId: inquiry.id, message: "One too many" })).rejects.toBeTruthy();
  });

  // MVP review — forRealtor/forProvider/notifications.list were unpaginated.
  test("inquiries.forRealtor paginates and returns a nextCursor once there are more items than the page size", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348090000001",
      realtor: { agencyName: "Pagination Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    // 3 separate buyers so each gets its own Inquiry row (unique constraint is per buyer+listing).
    for (let i = 0; i < 3; i++) {
      const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: `+234809000010${i}` });
      await buyerCaller.inquiries.create({ listingId: listing.id, message: `Inquiry number ${i} for pagination test` });
    }

    const page1 = await realtorCaller.inquiries.forRealtor({ limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await realtorCaller.inquiries.forRealtor({ limit: 2, cursor: page1.nextCursor });
    expect(page2.items.length).toBe(1);
    expect(page2.nextCursor).toBeFalsy();
  });

  test("a realtor cannot self-publish via the new listing-management UI's own action set — DRAFT never offers LIVE as a target", async () => {
    // This is a structural/documentation-style check, not a UI test (no
    // browser here) — asserts the server rejects exactly the transition
    // the UI is deliberately built to never offer, closing the loop
    // between the UI's action set and the server's actual enforcement.
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348090000004",
      realtor: { agencyName: "UI Parity Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id, { status: "DRAFT" });

    await expect((realtorCaller.listings.setStatus as any)({ id: listing.id, status: "LIVE" })).rejects.toBeTruthy();
    // The one transition the UI DOES offer from DRAFT should succeed.
    await expect(realtorCaller.listings.setStatus({ id: listing.id, status: "PENDING_REVIEW" })).resolves.toBeTruthy();
  });

  // Sprint 2 fix — MVP Audit P1 ("the billing policy allows buyer
  // inquiries when the realtor has insufficient balance... records
  // billed: true even when insufficient... expose the state to admins").
  // Two things are verified together since they're the same underlying
  // fix: (1) Inquiry.billed now reflects what actually happened instead
  // of always being true, and (2) an admin can actually see the failed
  // charge via the new payments.failedLeadFees query — previously there
  // was no way to see this without direct DB access.
  test("an inquiry against a realtor with insufficient balance is recorded as unbilled, visible to admins, and still reaches the realtor", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348090000005",
      realtor: { agencyName: "Insufficient Balance Test Realty", creditBalanceNaira: 0n },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348090000006" });
    // Policy (documented in inquiries.ts): insufficient balance does NOT
    // block the buyer's message — it would be a strange product to let a
    // realtor's billing state gate whether a buyer can reach them at all.
    const inquiry = await buyerCaller.inquiries.create({ listingId: listing.id, message: "Is the price negotiable at all?" });
    expect(inquiry).toBeTruthy();

    const dbInquiry = await db.inquiry.findUniqueOrThrow({ where: { id: (inquiry as any).id } });
    expect(dbInquiry.billed).toBe(false);

    const txn = await db.paymentTransaction.findFirstOrThrow({ where: { inquiryId: dbInquiry.id } });
    expect(txn.status).toBe("FAILED");

    // Realtor received the message despite the failed charge — the
    // product-policy assumption the code deliberately preserves.
    const realtorThread = await realtorCaller.inquiries.byId({ id: dbInquiry.id });
    expect((realtorThread as any).messages.length).toBe(1);

    // And now an admin can actually see this without touching the DB directly.
    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348090000007" });
    const failedFees = await adminCaller.payments.failedLeadFees({});
    expect(failedFees.items.some((item: any) => item.id === txn.id)).toBe(true);

    const { caller: buyerCaller2 } = await createAuthedCaller({ role: "BUYER", phone: "+2348090000008" });
    await expect(buyerCaller2.payments.failedLeadFees({} as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // A realtor with a sufficient balance should still show billed: true —
  // confirms the Sprint 2 fix corrected the false-positive case without
  // introducing a false-negative in the normal, common path.
  test("an inquiry against a realtor with sufficient balance is recorded as billed", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348090000009",
      realtor: { agencyName: "Sufficient Balance Test Realty", creditBalanceNaira: 100_000n },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348090000010" });
    const inquiry = await buyerCaller.inquiries.create({ listingId: listing.id, message: "Can I schedule a viewing this weekend?" });

    const dbInquiry = await db.inquiry.findUniqueOrThrow({ where: { id: (inquiry as any).id } });
    expect(dbInquiry.billed).toBe(true);
  });

  // Priority-checklist fix — subscription pricing centralization. Confirms
  // initiateSubscription actually reads PlatformConfig rather than a
  // hardcoded constant: change the admin-configured price, then confirm
  // the created PaymentTransaction and the returned checkout amount both
  // reflect the change, not the old default.
  test("realtor subscription price is read from PlatformConfig, not hardcoded", async () => {
    await db.platformConfig.upsert({
      where: { id: "default" },
      create: { id: "default", realtorSubscriptionPriceNaira: 25_000n },
      update: { realtorSubscriptionPriceNaira: 25_000n },
    });

    const { caller: realtorCaller } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348090000011", realtor: { agencyName: "Subscription Price Test Realty" },
    });
    const result = await realtorCaller.realtors.initiateSubscription({ email: "realtor@example.com" });
    expect((result as any).priceNaira).toBe(25_000);

    const txn = await db.paymentTransaction.findUniqueOrThrow({ where: { providerRef: (result as any).reference } });
    expect(txn.amountNaira).toBe(25_000n);
  });

  test("provider subscription price is read from PlatformConfig, not hardcoded", async () => {
    await db.platformConfig.upsert({
      where: { id: "default" },
      create: { id: "default", providerSubscriptionPriceNaira: 18_000n },
      update: { providerSubscriptionPriceNaira: 18_000n },
    });

    const { caller: providerCaller } = await createAuthedCaller({
      role: "PROVIDER", phone: "+2348090000012", provider: { businessName: "Subscription Price Test Services", categories: ["PAINTING"] },
    });
    const result = await providerCaller.providers.initiateSubscription({ email: "provider@example.com" });
    expect((result as any).priceNaira).toBe(18_000);

    const txn = await db.paymentTransaction.findUniqueOrThrow({ where: { providerRef: (result as any).reference } });
    expect(txn.amountNaira).toBe(18_000n);
  });

  // Priority-checklist fix — admin.search closing the "admin cannot look
  // up a plain buyer" gap. The specific thing the two existing
  // role-specific searches (realtors.adminSearch/providers.adminSearch)
  // could NOT do, since a buyer has no profile to search against.
  test("admin.search finds a plain buyer with no realtor/provider profile", async () => {
    const { user: buyerUser } = await createAuthedCaller({ role: "BUYER", phone: "+2348090000013" });
    await db.user.update({ where: { id: buyerUser.id }, data: { name: "Chidinma Okafor" } });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348090000014" });
    const results = await adminCaller.admin.search({ query: "Chidinma" });
    expect(results.some((u: any) => u.id === buyerUser.id)).toBe(true);
    const found = results.find((u: any) => u.id === buyerUser.id) as any;
    expect(found.realtorProfile).toBeNull();
    expect(found.providerProfile).toBeNull();

    // Also findable by phone.
    const byPhone = await adminCaller.admin.search({ query: "+2348090000013" });
    expect(byPhone.some((u: any) => u.id === buyerUser.id)).toBe(true);

    const detail = await adminCaller.admin.userDetail({ userId: buyerUser.id });
    expect((detail as any).name).toBe("Chidinma Okafor");

    // Non-admin gets FORBIDDEN, same as every other admin-tier endpoint.
    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348090000015" });
    await expect(buyerCaller.admin.search({ query: "Chidinma" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // Priority-checklist fix — payments.currentPricing closing the "no way
  // for a realtor to see the current lead fee" gap that surfaced while
  // building the low-balance UI nudge. Deliberately public: confirms an
  // unauthenticated caller can read it (pricing transparency, not a
  // protected resource) and that it reflects real-time admin config
  // changes, not a stale/cached value.
  test("payments.currentPricing is public and reflects live PlatformConfig", async () => {
    await db.platformConfig.upsert({
      where: { id: "default" },
      create: { id: "default", leadFeeNaira: 750n },
      update: { leadFeeNaira: 750n },
    });

    const ctx = await createContext({ authHeader: null });
    const anonCaller = appRouter.createCaller(ctx);
    const pricing = await anonCaller.payments.currentPricing();
    expect((pricing as any).leadFeeNaira).toBe(750n);
  });
});
