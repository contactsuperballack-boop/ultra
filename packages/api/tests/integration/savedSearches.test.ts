import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

describe("savedSearches router (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => resetDatabase());

  test("buyers can create, list, pause and delete only their own saved searches", async () => {
    const { caller: buyerA } = await createAuthedCaller({ role: "BUYER", phone: "+2348097000001" });
    const { caller: buyerB } = await createAuthedCaller({ role: "BUYER", phone: "+2348097000002" });

    const saved = await buyerA.savedSearches.create({
      name: "Three-bedroom homes in Gwarinpa",
      type: "SALE",
      query: "Gwarinpa",
      minBeds: 3,
      minBathrooms: 2,
      verifiedOnly: true,
    });
    expect((await buyerA.savedSearches.list()).length).toBe(1);
    expect((await buyerB.savedSearches.list()).length).toBe(0);

    await expect(buyerB.savedSearches.setAlerts({ id: saved.id, enabled: false })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await buyerA.savedSearches.setAlerts({ id: saved.id, enabled: false });
    expect((await buyerA.savedSearches.list())[0].alertEnabled).toBe(false);

    await expect(buyerB.savedSearches.delete({ id: saved.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await buyerA.savedSearches.delete({ id: saved.id });
    expect((await buyerA.savedSearches.list()).length).toBe(0);
  });

  test("only matching saved searches receive an alert when an admin publishes a listing", async () => {
    const { user: realtorUser } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348097000003", realtor: { agencyName: "Saved Search Realty" },
    });
    const realtor = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const { user: matchingBuyer, caller: matchingCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348097000004" });
    const { user: otherBuyer, caller: otherCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348097000005" });

    await matchingCaller.savedSearches.create({ name: "Gwarinpa 3 beds", type: "SALE", query: "Gwarinpa", minBeds: 3 });
    await otherCaller.savedSearches.create({ name: "Maitama rentals", type: "RENT", query: "Maitama" });

    const listing = await db.listing.create({
      data: {
        realtorProfileId: realtor.id,
        title: "Three bedroom home in Gwarinpa",
        description: "A completed three-bedroom property in Gwarinpa for this saved-search alert test.",
        type: "SALE", category: "RESIDENTIAL", priceNaira: 150_000_000n,
        area: "Gwarinpa", sizeSqm: 300, bedrooms: 3, bathrooms: 3, status: "PENDING_REVIEW",
      },
    });
    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348097000006" });
    await adminCaller.listings.adminSetStatus({ id: listing.id, status: "LIVE" });

    const matchingAlerts = await db.notification.findMany({ where: { userId: matchingBuyer.id, type: "SAVED_SEARCH_MATCH" } });
    const otherAlerts = await db.notification.findMany({ where: { userId: otherBuyer.id, type: "SAVED_SEARCH_MATCH" } });
    expect(matchingAlerts.length).toBe(1);
    expect(matchingAlerts[0].data).toMatchObject({ listingId: listing.id });
    expect(otherAlerts.length).toBe(0);
  });

  test("saved search creation is protected", async () => {
    const { appRouter, createContext } = await import("../../src");
    const anonymous = appRouter.createCaller(await createContext({ authHeader: null }));
    await expect(anonymous.savedSearches.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.savedSearches.create({ name: "Test search" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
