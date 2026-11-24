import { describe, test, expect, beforeEach } from "vitest";
import { appRouter, createContext } from "../../src";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";
import { generateOtpCode, hashOtpCode } from "../../src/lib/otp";

async function anonCaller() {
  const ctx = await createContext({ authHeader: null });
  return appRouter.createCaller(ctx);
}

async function createLiveListing(realtorProfileId: string) {
  return db.listing.create({
    data: {
      realtorProfileId,
      title: "Analytics test listing",
      description: "Long enough description to pass validation for this integration test fixture.",
      type: "SALE",
      priceNaira: 150_000_000n,
      area: "Jabi",
      sizeSqm: 400,
      status: "LIVE",
    },
  });
}

describe("Optimization Sprint A — analytics event tracking (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("first-time OTP verification fires exactly one user_registered event; a second login does not", async () => {
    const caller = await anonCaller();
    const phone = "+2348100000001";

    const otpResult = await caller.auth.requestOtp({ phone });
    await caller.auth.verifyOtp({ phone, code: (otpResult as any)._testOnlyCode });

    const events = await db.analyticsEvent.findMany({ where: { type: "user_registered" } });
    expect(events.length).toBe(1);

    // A second login for the SAME phone should not fire a second
    // registration event. Inserted directly rather than going through
    // auth.requestOtp again — that endpoint has a real 60-second
    // resend cooldown per phone (OTP_RESEND_COOLDOWN_MS), which this
    // synchronous test would otherwise hit on a second call.
    const secondCode = generateOtpCode();
    await db.otpCode.create({
      data: { phone, codeHash: hashOtpCode(secondCode), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    await caller.auth.verifyOtp({ phone, code: secondCode });
    const eventsAfterSecondLogin = await db.analyticsEvent.findMany({ where: { type: "user_registered" } });
    expect(eventsAfterSecondLogin.length).toBe(1);
  });

  test("viewing a listing fires listing_viewed with the listing id in properties", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348100000002",
      realtor: { agencyName: "Analytics Test Realty" },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348100000003" });
    await buyerCaller.listings.byId({ id: listing.id });

    const event = await db.analyticsEvent.findFirst({ where: { type: "listing_viewed" } });
    expect(event).toBeTruthy();
    expect((event!.properties as any).listingId).toBe(listing.id);
  });

  test("a listing search fires search_performed with domain='listings'; a paginated follow-up page does not", async () => {
    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348100000004" });
    const result = await buyerCaller.listings.search({ limit: 1 });

    const events = await db.analyticsEvent.findMany({ where: { type: "search_performed" } });
    expect(events.length).toBe(1);
    expect((events[0].properties as any).domain).toBe("listings");

    if (result.nextCursor) {
      await buyerCaller.listings.search({ limit: 1, cursor: result.nextCursor });
      const eventsAfterPage2 = await db.analyticsEvent.findMany({ where: { type: "search_performed" } });
      expect(eventsAfterPage2.length).toBe(1); // still 1 — cursor pages don't double-count
    }
  });

  test("a provider search fires search_performed with domain='services'", async () => {
    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348100000005" });
    await buyerCaller.providers.search({ limit: 10 });

    const event = await db.analyticsEvent.findFirst({ where: { type: "search_performed" } });
    expect(event).toBeTruthy();
    expect((event!.properties as any).domain).toBe("services");
  });

  test("a genuinely new inquiry fires inquiry_sent; a reply on the same thread does not fire it again", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348100000006",
      realtor: { agencyName: "Inquiry Analytics Test Realty", creditBalanceNaira: 5_000n },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await createLiveListing(realtorProfile.id);

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348100000007" });
    await buyerCaller.inquiries.create({ listingId: listing.id, message: "Is this property still available?" });

    let events = await db.analyticsEvent.findMany({ where: { type: "inquiry_sent" } });
    expect(events.length).toBe(1);

    // Same buyer, same listing — dedup logic makes this an append, not a
    // new inquiry (see inquiries.ts's own comment on this) — should not
    // fire a second inquiry_sent event.
    await buyerCaller.inquiries.create({ listingId: listing.id, message: "Following up on availability" });
    events = await db.analyticsEvent.findMany({ where: { type: "inquiry_sent" } });
    expect(events.length).toBe(1);
  });

  test("creating a service request fires service_request_created", async () => {
    const { user: providerUser } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348100000008",
      provider: { businessName: "Analytics Test Plumbing", categories: ["PLUMBING"] },
    });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });

    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348100000009" });
    await customerCaller.serviceRequests.create({
      providerProfileId: providerProfile.id,
      category: "PLUMBING",
      note: "Kitchen sink is leaking badly under the cabinet.",
    });

    const event = await db.analyticsEvent.findFirst({ where: { type: "service_request_created" } });
    expect(event).toBeTruthy();
    expect((event!.properties as any).category).toBe("PLUMBING");
  });

  test("completing a job fires job_completed with the commission amount recorded as a string (not a raw BigInt)", async () => {
    const { caller: providerCaller, user: providerUser } = await createAuthedCaller({
      role: "PROVIDER",
      phone: "+2348100000010",
      provider: { businessName: "Analytics Completion Test", categories: ["ELECTRICAL"] },
    });
    const providerProfile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    const { caller: customerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348100000011" });

    const request = await customerCaller.serviceRequests.create({
      providerProfileId: providerProfile.id,
      category: "ELECTRICAL",
      note: "Need an additional outlet installed in the home office.",
    });
    await providerCaller.serviceRequests.respond({ serviceRequestId: request.id, status: "ACCEPTED", agreedPriceNaira: 20_000 });
    await providerCaller.serviceRequests.complete({ serviceRequestId: request.id });

    const event = await db.analyticsEvent.findFirst({ where: { type: "job_completed" } });
    expect(event).toBeTruthy();
    // This is the actual point of this test — a raw BigInt passed into a
    // Json properties field would throw at either the Prisma layer or
    // (if it somehow got that far) inside PostHogAnalyticsProvider's
    // JSON.stringify. Confirms it was converted to a string first.
    expect(typeof (event!.properties as any).commissionNaira).toBe("string");
    expect((event!.properties as any).commissionNaira).toBe("2000"); // 10% of 20,000
  });
});
