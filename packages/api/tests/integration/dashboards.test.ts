import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

describe("role dashboards (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => { await resetDatabase(); });

  test("buyer overview is scoped to the signed-in buyer and returns workspace counts", async () => {
    const { caller: buyer, user } = await createAuthedCaller({ role: "BUYER", phone: "+2348067000001" });
    const { caller: other } = await createAuthedCaller({ role: "BUYER", phone: "+2348067000002" });
    const listingOwner = await createAuthedCaller({ role: "REALTOR", phone: "+2348067000003", realtor: { agencyName: "Dashboard Test Realty" } });
    const created = await listingOwner.caller.listings.create({
      title: "Buyer dashboard test home",
      description: "A completed family residence in a secure estate with good access and reliable utilities.",
      type: "SALE", category: "RESIDENTIAL", area: "Guzape", sizeSqm: 400, priceNaira: 250_000_000,
      bedrooms: 4, photos: [{ url: "https://example.com/dashboard-home.jpg" }],
    });
    await db.listing.update({ where: { id: created.listing.id }, data: { status: "LIVE", publishedAt: new Date() } });
    await buyer.savedListings.toggle({ listingId: created.listing.id });
    await buyer.savedSearches.create({ name: "Guzape homes", area: "Guzape", type: "SALE" });
    const result = await buyer.dashboards.buyerOverview();
    expect(result.counts.savedProperties).toBe(1);
    expect(result.counts.savedSearches).toBe(1);
    expect(result.recentSaved[0]?.id).toBe(created.listing.id);
    expect((await other.dashboards.buyerOverview()).counts.savedProperties).toBe(0);
    expect(result.counts.unreadNotifications).toBe(0);
    expect(user.id).toBeTruthy();
  });

  test("realtor overview only returns the caller's portfolio and business profile", async () => {
    const { caller: realtor, user } = await createAuthedCaller({ role: "REALTOR", phone: "+2348067000011", realtor: { agencyName: "Northstar Realty" } });
    const { caller: other } = await createAuthedCaller({ role: "REALTOR", phone: "+2348067000012", realtor: { agencyName: "Other Realty" } });
    const result = await realtor.dashboards.realtorOverview();
    expect(result.profile.agencyName).toBe("Northstar Realty");
    expect(result.totals.listings).toBe(0);
    expect(result.totals.inquiries).toBe(0);
    expect(result.recentListings).toHaveLength(0);
    expect((await other.dashboards.realtorOverview()).profile.agencyName).toBe("Other Realty");
    expect(user.realtorProfile?.id).toBeTruthy();
  });

  test("unverified accounts cannot access realtor portfolio metrics", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348067000021" });
    await expect(caller.dashboards.realtorOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("provider dashboard summarizes its own service workload and recurring pipeline", async () => {
    process.env.HOME_SERVICES_ENABLED = "true";
    const { caller: provider, user: providerUser } = await createAuthedCaller({ role: "PROVIDER", phone: "+2348067000031", provider: { businessName: "Dashboard Plumbing", categories: ["PLUMBING"] } });
    const { caller: customer } = await createAuthedCaller({ role: "BUYER", phone: "+2348067000032" });
    const profile = await db.providerProfile.findUniqueOrThrow({ where: { userId: providerUser.id } });
    const offering = await provider.providers.createOffering({ category: "PLUMBING", title: "Residential plumbing callout", description: "Inspection and minor residential plumbing repairs.", priceType: "FIXED", priceNaira: 25000 });
    await customer.serviceRequests.create({ providerProfileId: profile.id, offeringId: offering.id, category: "PLUMBING", note: "Kitchen sink pipe is leaking and needs inspection." });
    const summary = await provider.providers.dashboardSummary();
    expect(summary.activeOfferings).toBe(1);
    expect(summary.pendingRequests).toBe(1);
    expect(summary.totalRequests).toBe(1);
    expect(summary.recentRequests[0]?.customer.name).toBe("Test BUYER");
  });
});
