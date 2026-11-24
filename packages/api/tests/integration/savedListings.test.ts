import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

/**
 * Priority-checklist fix — savedListings.ts had zero integration test
 * coverage of any kind (confirmed by grepping every file in this
 * directory for ".savedListings." before writing this file — not
 * assumed from the audit's description). Small router, but a broken
 * save-toggle is a real, visible bug to a real user, which is the
 * standard the Product Readiness Audit held this gap to.
 *
 * Structurally reviewed against the actual router, not executed — same
 * disclosure as every other integration test in this suite.
 */
async function createLiveListing(realtorProfileId: string) {
  return db.listing.create({
    data: {
      realtorProfileId,
      title: "Saved-listing test listing",
      description: "Long enough description to pass validation for this integration test fixture.",
      type: "SALE",
      priceNaira: 150_000_000n,
      area: "Gwarinpa",
      sizeSqm: 400,
      status: "LIVE",
    },
  });
}

describe("savedListings router (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("toggle saves a listing, then un-saves it on a second call", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348091000001", realtor: { agencyName: "Saved Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348091000002" });

    const first = await buyerCaller.savedListings.toggle({ listingId: listing.id });
    expect((first as any).saved).toBe(true);

    let ids = await buyerCaller.savedListings.ids();
    expect(ids).toContain(listing.id);

    const second = await buyerCaller.savedListings.toggle({ listingId: listing.id });
    expect((second as any).saved).toBe(false);

    ids = await buyerCaller.savedListings.ids();
    expect(ids).not.toContain(listing.id);
  });

  test("list returns full listing data for saved listings, scoped to the caller", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348091000003", realtor: { agencyName: "Saved List Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerACaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348091000004" });
    const { caller: buyerBCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348091000005" });

    await buyerACaller.savedListings.toggle({ listingId: listing.id });

    const buyerAList = await buyerACaller.savedListings.list();
    expect(buyerAList.length).toBe(1);
    expect((buyerAList[0] as any).id).toBe(listing.id);

    // Buyer B never saved anything — confirms `list`/`ids` are scoped per
    // caller, not accidentally global.
    const buyerBList = await buyerBCaller.savedListings.list();
    expect(buyerBList.length).toBe(0);
    const buyerBIds = await buyerBCaller.savedListings.ids();
    expect(buyerBIds.length).toBe(0);
  });

  test("toggling a nonexistent listing id fails rather than silently succeeding", async () => {
    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348091000006" });
    // No FK check happens before the create in the router as written —
    // this test documents the actual current behavior (a foreign-key
    // violation surfaces as an error) rather than assuming a specific
    // error shape the router doesn't explicitly construct.
    await expect(buyerCaller.savedListings.toggle({ listingId: "nonexistent-listing-id" })).rejects.toBeTruthy();
  });

  test("buyers cannot save a non-public listing and hidden listings are excluded from their saved list", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348091000011", realtor: { agencyName: "Private Listing Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const live = await createLiveListing(realtorProfile.id);
    const pending = await db.listing.create({
      data: {
        realtorProfileId: realtorProfile.id,
        title: "Pending private listing",
        description: "This listing is pending review and must not be exposed through saved listings.",
        type: "SALE", priceNaira: 100_000_000n, area: "Jabi", sizeSqm: 250, status: "PENDING_REVIEW",
      },
    });
    const { caller: buyer } = await createAuthedCaller({ role: "BUYER", phone: "+2348091000012" });
    await buyer.savedListings.toggle({ listingId: live.id });
    await expect(buyer.savedListings.toggle({ listingId: pending.id })).rejects.toMatchObject({ code: "NOT_FOUND" });

    await db.listing.update({ where: { id: live.id }, data: { status: "REMOVED" } });
    expect(await buyer.savedListings.list()).toHaveLength(0);
  });

  test("an unauthenticated caller cannot use any savedListings procedure", async () => {
    const { appRouter, createContext } = await import("../../src");
    const ctx = await createContext({ authHeader: null });
    const anonCaller = appRouter.createCaller(ctx);
    await expect(anonCaller.savedListings.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonCaller.savedListings.ids()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonCaller.savedListings.toggle({ listingId: "any-id" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
