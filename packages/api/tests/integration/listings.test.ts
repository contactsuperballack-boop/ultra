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

  test("property comparison returns only LIVE listings and preserves the requested order", async () => {
    const { user } = await createAuthedCaller({ role: "REALTOR", phone: "+2348010000031", realtor: { agencyName: "Compare Realty" } });
    const realtor = await db.realtorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const live = await db.listing.create({
      data: { realtorProfileId: realtor.id, title: "Live compare property", description: "A completed property that can be compared publicly.", type: "SALE", category: "RESIDENTIAL", priceNaira: 90_000_000n, area: "Jabi", sizeSqm: 220, status: "LIVE", publishedAt: new Date() },
    });
    const pending = await db.listing.create({
      data: { realtorProfileId: realtor.id, title: "Private compare property", description: "A property still awaiting moderation and not public.", type: "SALE", category: "RESIDENTIAL", priceNaira: 110_000_000n, area: "Maitama", sizeSqm: 260, status: "PENDING_REVIEW" },
    });
    const { appRouter, createContext } = await import("../../src");
    const publicCaller = appRouter.createCaller(await createContext({ authHeader: null }));
    const result = await publicCaller.listings.compare({ ids: [pending.id, live.id] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(live.id);
  });

  test("public search applies the minimum bathroom filter", async () => {
    const { caller, user } = await createAuthedCaller({ role: "REALTOR", phone: "+2348010000029", realtor: { agencyName: "Bathroom Filter Realty" } });
    const realtor = await db.realtorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    await db.listing.createMany({
      data: [
        { realtorProfileId: realtor.id, title: "One bath home", description: "A completed home with one bathroom in this search filter test.", type: "SALE", category: "RESIDENTIAL", priceNaira: 80_000_000n, area: "Jabi", sizeSqm: 200, bedrooms: 2, bathrooms: 1, status: "LIVE", publishedAt: new Date() },
        { realtorProfileId: realtor.id, title: "Three bath home", description: "A completed home with three bathrooms in this search filter test.", type: "SALE", category: "RESIDENTIAL", priceNaira: 120_000_000n, area: "Jabi", sizeSqm: 260, bedrooms: 3, bathrooms: 3, status: "LIVE", publishedAt: new Date() },
      ],
    });
    const results = await caller.listings.search({ type: "SALE", minBathrooms: 2 });
    expect(results.items).toHaveLength(1);
    expect(results.items[0].title).toBe("Three bath home");
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

  test("matching perceptual image hashes across different areas route a listing to human review", async () => {
    const { caller: firstRealtor } = await createAuthedCaller({ role: "REALTOR", phone: "+2348010000021", realtor: { agencyName: "First Image Realty" } });
    const { caller: secondRealtor } = await createAuthedCaller({ role: "REALTOR", phone: "+2348010000022", realtor: { agencyName: "Second Image Realty" } });

    await firstRealtor.listings.create({
      title: "Completed home in Gwarinpa",
      description: "A completed residential property with a garden and parking in Gwarinpa district.",
      type: "SALE", category: "RESIDENTIAL", priceNaira: 120_000_000, area: "Gwarinpa", sizeSqm: 300,
      photos: [{ url: "https://example.com/first.jpg", contentHash: "0000000000000000" }],
    });
    const result = await secondRealtor.listings.create({
      title: "Completed home in Jabi",
      description: "A different residential property in Jabi, with a garden and secure parking spaces.",
      type: "SALE", category: "RESIDENTIAL", priceNaira: 125_000_000, area: "Jabi", sizeSqm: 310,
      photos: [{ url: "https://example.com/second.jpg", contentHash: "000000000000001f" }],
    });

    expect(result.autoFlagged).toBe(true);
    expect(result.listing.status).toBe("UNDER_REVIEW");
    expect(result.listing.flagReason).toMatch(/photo\(s\) match/i);
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

  test("admin review queue returns full public profile claims, linked development and every photo", async () => {
    const { caller: realtorCaller } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348010000011",
      realtor: { agencyName: "Profile Review Realty" },
    });
    const development = await realtorCaller.developments.create({
      name: "Maitama Gardens",
      description: "A completed residential development with landscaped shared spaces and secure access.",
      area: "Maitama",
      architect: "A. Architect",
      builder: "BuildCo Nigeria",
      developer: "Maitama Developments",
      completionYear: 2024,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    await realtorCaller.listings.create({
      title: "Three Bedroom Apartment in Maitama",
      description: "A spacious completed apartment in a well-maintained residential development in Maitama.",
      type: "SALE",
      category: "RESIDENTIAL",
      priceNaira: 500_000_000,
      area: "Maitama",
      sizeSqm: 320,
      photos: [
        { url: "https://example.com/exterior.jpg", roomType: "EXTERIOR" },
        { url: "https://example.com/floor-plan.jpg", roomType: "FLOOR_PLAN" },
      ],
      architect: "A. Architect",
      builder: "BuildCo Nigeria",
      developer: "Maitama Developments",
      completionYear: 2024,
      ownerStatement: "This is a statement supplied by the property owner for review by prospective buyers.",
      statementAuthorRole: "OWNER",
      statementAuthorName: "Property Owner",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      developmentId: development.id,
    });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348010000012" });
    const queue = await adminCaller.listings.flagged({});
    const reviewed = queue.items.find((item) => item.title === "Three Bedroom Apartment in Maitama");

    expect(reviewed).toBeDefined();
    expect(reviewed?.architect).toBe("A. Architect");
    expect(reviewed?.builder).toBe("BuildCo Nigeria");
    expect(reviewed?.developer).toBe("Maitama Developments");
    expect(reviewed?.ownerStatement).toContain("statement supplied by the property owner");
    expect(reviewed?.statementAuthorRole).toBe("OWNER");
    expect(reviewed?.youtubeVideoId).toBe("dQw4w9WgXcQ");
    expect(reviewed?.development?.name).toBe("Maitama Gardens");
    expect(reviewed?.photos).toHaveLength(2);
    expect(reviewed?.photos.some((photo) => photo.roomType === "FLOOR_PLAN")).toBe(true);
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
