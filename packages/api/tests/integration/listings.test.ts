import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";
import { signAccessToken } from "../../src/lib/tokens";
import { appRouter, createContext } from "../../src";

describe("listings — price-band flagging (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("a listing priced inside the band goes to PENDING_REVIEW, not directly LIVE", async () => {
    const { caller } = await createAuthedCaller({ role: "REALTOR", phone: "+2348010000001", realtor: { agencyName: "Test Realty" } });

    const result = await caller.listings.create({
      title: "3-Bed Duplex, Maitama",
      description: "A well-finished duplex in a quiet Maitama close, minimum twenty characters here.",
      type: "SALE",
      priceNaira: 500_000_000, // ~500,000/sqm at 1000sqm — inside Maitama's 350k-900k band
      area: "Maitama",
      sizeSqm: 1000,
      photos: [{ url: "https://example.com/photo1.jpg" }],
    });

    expect(result.autoFlagged).toBe(false);
    expect(result.listing.status).toBe("PENDING_REVIEW");
    expect(result.listing.flagReason).toBeNull();
  });

  test("a listing priced outside the band is auto-flagged UNDER_REVIEW with a reason", async () => {
    const { caller } = await createAuthedCaller({ role: "REALTOR", phone: "+2348010000002", realtor: { agencyName: "Test Realty 2" } });

    const result = await caller.listings.create({
      title: "Suspiciously Cheap Plot, Maitama",
      description: "A plot of land priced well below what Maitama plots typically go for, minimum length.",
      type: "LAND",
      priceNaira: 10_000_000, // 10,000/sqm at 1000sqm — well below Maitama's 350,000 floor
      area: "Maitama",
      sizeSqm: 1000,
      photos: [{ url: "https://example.com/photo2.jpg" }],
    });

    expect(result.autoFlagged).toBe(true);
    expect(result.listing.status).toBe("UNDER_REVIEW");
    expect(result.listing.flagReason).toMatch(/unusually low/);
  });

  test("an unverified realtor cannot create a listing", async () => {
    const user = await db.user.create({
      data: {
        phone: "+2348010000003",
        phoneVerified: true,
        name: "Unverified Realtor",
        role: "REALTOR",
        realtorProfile: { create: { agencyName: "Pending Agency", verificationStatus: "PENDING_REVIEW" } },
      },
    });
    const token = signAccessToken({ sub: user.id, role: "REALTOR" });
    const ctx = await createContext({ authHeader: `Bearer ${token}` });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.listings.create({
        title: "Should Not Be Allowed",
        description: "This should be rejected because the realtor profile is not VERIFIED yet.",
        type: "SALE",
        priceNaira: 100_000_000,
        area: "Jabi",
        sizeSqm: 300,
        photos: [{ url: "https://example.com/x.jpg" }],
      })
    ).rejects.toThrow(/Verified realtor/);
  });

  test("admin flagged queue surfaces UNDER_REVIEW and PENDING_REVIEW listings, most-flagged first", async () => {
    const { caller: realtorCaller } = await createAuthedCaller({ role: "REALTOR", phone: "+2348010000004", realtor: { agencyName: "Queue Test Realty" } });
    await realtorCaller.listings.create({
      title: "In-band listing", description: "A listing priced within the normal expected range for its area.",
      type: "SALE", priceNaira: 500_000_000, area: "Maitama", sizeSqm: 1000, photos: [{ url: "https://example.com/a.jpg" }],
    });
    await realtorCaller.listings.create({
      title: "Flagged listing", description: "A listing priced well outside the normal expected range for its area.",
      type: "LAND", priceNaira: 10_000_000, area: "Maitama", sizeSqm: 1000, photos: [{ url: "https://example.com/b.jpg" }],
    });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348010000005" });
    const queue = await adminCaller.listings.flagged({});

    expect(queue.items).toHaveLength(2);
    expect(queue.items[0].status).toBe("UNDER_REVIEW"); // flagged surfaces first, per the router's orderBy
  });
});
