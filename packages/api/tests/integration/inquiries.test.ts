import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";
import { LEAD_FEE_NAIRA } from "../../src/routers/inquiries";

async function createLiveListing(realtorCaller: any, overrides: Partial<any> = {}) {
  // Listings created via the router start PENDING_REVIEW/UNDER_REVIEW, never
  // LIVE — so tests that need a LIVE listing to inquire against create it
  // via the router (exercising real validation) then flip status directly,
  // the same way an admin approval would.
  const { listing } = await realtorCaller.listings.create({
    title: "Test Listing", description: "A listing created for integration testing purposes only, long enough.",
    type: "SALE", priceNaira: 500_000_000, area: "Maitama", sizeSqm: 1000, photos: [{ url: "https://example.com/a.jpg" }],
    ...overrides,
  });
  await db.listing.update({ where: { id: listing.id }, data: { status: "LIVE", publishedAt: new Date() } });
  return listing;
}

describe("inquiries — lead billing and notifications (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("a new inquiry with sufficient realtor balance deducts the lead fee and marks the transaction SUCCESS", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348020000001", realtor: { agencyName: "Billing Test Realty", creditBalanceNaira: 10_000n },
    });
    const listing = await createLiveListing(realtorCaller);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348020000002" });
    await buyerCaller.inquiries.create({ listingId: listing.id, message: "Is this still available?" });

    const profile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    expect(profile.creditBalanceNaira).toBe(10_000n - LEAD_FEE_NAIRA);

    const transaction = await db.paymentTransaction.findFirst({ where: { realtorProfileId: profile.id, type: "LEAD_FEE" } });
    expect(transaction?.status).toBe("SUCCESS");
    expect(transaction?.amountNaira).toBe(LEAD_FEE_NAIRA);
  });

  test("a new inquiry with insufficient realtor balance still succeeds for the buyer, but the fee is recorded FAILED", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348020000003", realtor: { agencyName: "Broke Realty", creditBalanceNaira: 100n }, // less than LEAD_FEE_NAIRA
    });
    const listing = await createLiveListing(realtorCaller);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348020000004" });

    // This is the actual policy under test: the mutation must NOT throw.
    const inquiry = await buyerCaller.inquiries.create({ listingId: listing.id, message: "Hello, is this available?" });
    expect(inquiry.id).toBeTruthy();

    const profile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    expect(profile.creditBalanceNaira).toBe(100n); // unchanged — balance was NOT decremented into the negative

    const transaction = await db.paymentTransaction.findFirst({ where: { realtorProfileId: profile.id, type: "LEAD_FEE" } });
    expect(transaction?.status).toBe("FAILED");
  });

  test("a follow-up message in an existing thread does not create a second LEAD_FEE transaction", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348020000005", realtor: { agencyName: "Repeat Test Realty", creditBalanceNaira: 10_000n },
    });
    const listing = await createLiveListing(realtorCaller);
    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348020000006" });

    await buyerCaller.inquiries.create({ listingId: listing.id, message: "First message" });
    await buyerCaller.inquiries.create({ listingId: listing.id, message: "Second message, same listing" });

    const feeCount = await db.paymentTransaction.count({
      where: { realtorProfileId: realtorUser.realtorProfile!.id, type: "LEAD_FEE" },
    });
    expect(feeCount).toBe(1); // only the first message billed
  });

  test("sending a message creates an in-app Notification for the other participant", async () => {
    const { caller: realtorCaller, user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348020000007", realtor: { agencyName: "Notify Test Realty", creditBalanceNaira: 10_000n },
    });
    const listing = await createLiveListing(realtorCaller);
    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348020000008" });

    await buyerCaller.inquiries.create({ listingId: listing.id, message: "Notify the realtor please" });

    const notification = await db.notification.findFirst({ where: { userId: realtorUser.id, type: "NEW_MESSAGE" } });
    expect(notification).toBeTruthy();
    expect(notification?.readAt).toBeNull();
  });
});
