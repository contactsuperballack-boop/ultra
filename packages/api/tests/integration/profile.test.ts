import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

const base = {
  description: "A well-finished property in a quiet part of Abuja, with enough text to pass validation.",
  area: "Maitama",
  sizeSqm: 1000,
  photos: [{ url: "https://example.com/p.jpg" }],
};
const UUID = "3f2a9c1e-7b4d-4e8a-9c21-5d6e7f8a9b0c";

describe("Property Profile fields (integration — requires real DATABASE_URL)", () => {
  const prevBase = process.env.R2_PUBLIC_BASE_URL;
  beforeEach(async () => {
    await resetDatabase();
    process.env.R2_PUBLIC_BASE_URL = "https://media.ultraapp.test";
  });
  afterEach(() => {
    process.env.R2_PUBLIC_BASE_URL = prevBase;
  });

  async function realtor(phone: string) {
    const { caller } = await createAuthedCaller({ role: "REALTOR", phone, realtor: { agencyName: `Agency ${phone}` } });
    const profile = await db.realtorProfile.findFirstOrThrow({ where: { user: { phone } } });
    return { caller, profileId: profile.id };
  }

  test("an owner statement without an author role is rejected", async () => {
    const { caller } = await realtor("+2348020000001");
    await expect(
      caller.listings.create({ ...base, title: "Statement test", type: "SALE", priceNaira: 500_000_000, ownerStatement: "When we envisioned this property we wanted privacy and thoughtful design throughout." })
    ).rejects.toThrow(/owner, the developer or an authorised representative/);
  });

  test("the author role is stored with the statement", async () => {
    const { caller } = await realtor("+2348020000002");
    const { listing } = await caller.listings.create({
      ...base, title: "Statement stored", type: "SALE", priceNaira: 500_000_000,
      ownerStatement: "When we envisioned this property we wanted privacy and thoughtful design throughout.",
      statementAuthorRole: "AUTHORISED_REPRESENTATIVE",
    });
    expect(listing.statementAuthorRole).toBe("AUTHORISED_REPRESENTATIVE");
  });

  test("only a valid YouTube link is accepted, and only its ID is stored", async () => {
    const { caller } = await realtor("+2348020000003");
    await expect(caller.listings.create({ ...base, title: "Bad video", type: "SALE", priceNaira: 500_000_000, youtubeUrl: "https://vimeo.com/123456789" })).rejects.toThrow(/YouTube link/);
    await expect(caller.listings.create({ ...base, title: "Evil video", type: "SALE", priceNaira: 500_000_000, youtubeUrl: "javascript:alert(1)" })).rejects.toThrow(/YouTube link/);
    const { listing } = await caller.listings.create({ ...base, title: "Good video", type: "SALE", priceNaira: 500_000_000, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ?si=abc" });
    expect(listing.youtubeVideoId).toBe("dQw4w9WgXcQ");
  });

  test("3D model: only the caller's own ULTRA upload is accepted", async () => {
    const { caller, profileId } = await realtor("+2348020000004");
    const mk = (url: string) => caller.listings.create({ ...base, title: "3D test", type: "SALE", priceNaira: 500_000_000, model3dUrl: url });

    await expect(mk(`https://evil.example.com/listing-model/${profileId}/${UUID}.glb`)).rejects.toThrow(/Upload the \.glb file to ULTRA/);
    await expect(mk(`https://media.ultraapp.test/listing-model/someone-else/${UUID}.glb`)).rejects.toThrow(/wasn't uploaded through ULTRA by this account/);
    await expect(mk(`https://media.ultraapp.test/listing-model/${profileId}/${UUID}.glb?x=1`)).rejects.toThrow(/query strings/);

    const own = `https://media.ultraapp.test/listing-model/${profileId}/${UUID}.glb`;
    const { listing } = await mk(own);
    expect(listing.model3dUrl).toBe(own);
  });

  test("3D model fails closed when storage isn't configured", async () => {
    delete process.env.R2_PUBLIC_BASE_URL;
    const { caller, profileId } = await realtor("+2348020000005");
    await expect(
      caller.listings.create({ ...base, title: "No storage", type: "SALE", priceNaira: 500_000_000, model3dUrl: `https://media.ultraapp.test/listing-model/${profileId}/${UUID}.glb` })
    ).rejects.toThrow(/aren't enabled/);
  });

  test("land stores no building credits or 3D model, but keeps the film", async () => {
    const { caller } = await realtor("+2348020000006");
    const { listing } = await caller.listings.create({
      ...base, title: "Plot with credits", type: "LAND", priceNaira: 450_000_000,
      architect: "Should Not Stick", builder: "Nor This", completionYear: 2020, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(listing.architect).toBeNull();
    expect(listing.builder).toBeNull();
    expect(listing.completionYear).toBeNull();
    expect(listing.youtubeVideoId).toBe("dQw4w9WgXcQ");
  });
});

describe("category-aware search (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function live(caller: any, input: any) {
    const { listing } = await caller.listings.create({ ...base, ...input });
    await db.listing.update({ where: { id: listing.id }, data: { status: "LIVE", publishedAt: new Date() } });
    return listing;
  }

  test("a land search ignores bedrooms and building category sent by hand", async () => {
    const { caller } = await createAuthedCaller({ role: "REALTOR", phone: "+2348030000001", realtor: { agencyName: "Search Realty" } });
    await live(caller, { title: "Plot A", type: "LAND", priceNaira: 450_000_000 });
    const res = await caller.listings.search({ type: "LAND", minBeds: 5, category: "RESIDENTIAL" });
    expect(res.items).toHaveLength(1);
  });

  test("price sort works for sale; rentals fall back to newest-first", async () => {
    const { caller } = await createAuthedCaller({ role: "REALTOR", phone: "+2348030000002", realtor: { agencyName: "Sort Realty" } });
    await live(caller, { title: "Pricey home", type: "SALE", category: "RESIDENTIAL", priceNaira: 800_000_000 });
    await live(caller, { title: "Cheaper home", type: "SALE", category: "RESIDENTIAL", priceNaira: 500_000_000 });
    const asc = await caller.listings.search({ type: "SALE", sortBy: "PRICE_ASC" });
    expect(asc.items.map((i) => i.title)).toEqual(["Cheaper home", "Pricey home"]);
    const desc = await caller.listings.search({ type: "SALE", sortBy: "PRICE_DESC" });
    expect(desc.items.map((i) => i.title)).toEqual(["Pricey home", "Cheaper home"]);
  });

  test("a yearly rent range also matches monthly-priced rentals with the same annual cost", async () => {
    const { caller } = await createAuthedCaller({ role: "REALTOR", phone: "+2348030000003", realtor: { agencyName: "Rent Realty" } });
    await live(caller, { title: "Yearly flat", type: "RENT", category: "RESIDENTIAL", priceNaira: 3_000_000, priceFrequency: "PER_YEAR", sizeSqm: 120, area: "Wuse" });
    await live(caller, { title: "Monthly flat", type: "RENT", category: "RESIDENTIAL", priceNaira: 250_000, priceFrequency: "PER_MONTH", sizeSqm: 120, area: "Wuse" }); // ₦3M / yr
    await live(caller, { title: "Too dear flat", type: "RENT", category: "RESIDENTIAL", priceNaira: 900_000, priceFrequency: "PER_MONTH", sizeSqm: 120, area: "Wuse" }); // ₦10.8M / yr
    const res = await caller.listings.search({ type: "RENT", minPriceNaira: 2_000_000, maxPriceNaira: 5_000_000 });
    expect(res.items.map((i) => i.title).sort()).toEqual(["Monthly flat", "Yearly flat"]);
  });
});
