import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

const dev = {
  name: "Riverside Gardens",
  description: "A gated estate of detached homes on the edge of Abuja, with shared amenities and a single management company.",
  area: "Guzape",
};
const unit = (n: number | string, extra: Record<string, unknown> = {}) => ({
  title: `Riverside Gardens unit ${n}`,
  description: "A well-finished home inside the estate, with enough text to pass validation.",
  type: "SALE" as const,
  category: "RESIDENTIAL" as const,
  area: "Guzape",
  sizeSqm: 600,
  priceNaira: 400_000_000,
  bedrooms: 4,
  photos: [{ url: "https://example.com/p.jpg" }],
  unitNumber: String(n),
  ...extra,
});

describe("developments and units (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function realtor(phone: string) {
    const { caller } = await createAuthedCaller({ role: "REALTOR", phone, realtor: { agencyName: `Agency ${phone}` } });
    return caller;
  }

  test("one parent profile can carry 30 separately managed units without copying the development", async () => {
    const r = await realtor("+2348050000001");
    const d = await r.developments.create({ ...dev, architect: "Studio Example", completionYear: 2024 });
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348050000090" });
    await expect(r.developments.byId({ id: d.id })).rejects.toThrow();
    await admin.admin.reviewDevelopment({ id: d.id, decision: "APPROVED", note: "Reviewed" });
    for (let i = 1; i <= 30; i++) await r.listings.create({ ...unit(i), developmentId: d.id });

    expect(await db.listing.count({ where: { developmentId: d.id } })).toBe(30);
    expect(await db.development.count()).toBe(1);
    // development-level facts were never copied onto the units
    const first = await db.listing.findFirstOrThrow({ where: { developmentId: d.id } });
    expect(first.architect).toBeNull();

    await db.listing.updateMany({ where: { developmentId: d.id, unitNumber: { in: ["1", "2", "3"] } }, data: { status: "LIVE", publishedAt: new Date() } });
    const page = await (await realtor("+2348050000002")).developments.byId({ id: d.id });
    expect(page.units).toHaveLength(3);
    expect(page.summary.availableCount).toBe(3);
  });

  test("a unit number can't be reused in a development, however it's typed", async () => {
    const r = await realtor("+2348050000003");
    const d = await r.developments.create(dev);
    await r.listings.create({ ...unit("a 1"), developmentId: d.id });
    await expect(r.listings.create({ ...unit("A  1"), developmentId: d.id })).rejects.toThrow(/already exists/);
  });

  test("a unit needs a valid number, and a number needs a development", async () => {
    const r = await realtor("+2348050000004");
    const d = await r.developments.create(dev);
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348050000092" });
    await admin.admin.reviewDevelopment({ id: d.id, decision: "APPROVED" });
    await expect(r.listings.create({ ...unit("<b>1</b>"), developmentId: d.id })).rejects.toThrow(/unit number/i);
    await expect(r.listings.create({ ...unit("7") })).rejects.toThrow(/only applies to a unit of a development/);
  });

  test("you can't attach a unit to someone else's development", async () => {
    const owner = await realtor("+2348050000005");
    const other = await realtor("+2348050000006");
    const d = await owner.developments.create(dev);
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348050000093" });
    await admin.admin.reviewDevelopment({ id: d.id, decision: "APPROVED" });
    await expect(other.listings.create({ ...unit("1"), developmentId: d.id })).rejects.toThrow(/your own developments/);
    await expect(other.developments.update({ id: d.id, data: { ...dev, name: "Hijacked" } })).rejects.toThrow();
  });

  test("the public page shows only LIVE units, with a price range", async () => {
    const r = await realtor("+2348050000007");
    const d = await r.developments.create(dev);
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348050000094" });
    await admin.admin.reviewDevelopment({ id: d.id, decision: "APPROVED" });
    const a = await r.listings.create({ ...unit("1", { priceNaira: 300_000_000 }), developmentId: d.id });
    const b = await r.listings.create({ ...unit("2", { priceNaira: 450_000_000, bedrooms: 5 }), developmentId: d.id });
    await r.listings.create({ ...unit("3"), developmentId: d.id }); // stays a draft/under review
    await db.listing.updateMany({ where: { id: { in: [a.listing.id, b.listing.id] } }, data: { status: "LIVE", publishedAt: new Date() } });

    const page = await r.developments.byId({ id: d.id });
    expect(page.units.map((u) => u.unitNumber)).toEqual(["1", "2"]);
    expect(page.summary).toMatchObject({ availableCount: 2, bedroomOptions: [4, 5] });
    expect(Number(page.summary.minPriceNaira)).toBe(300_000_000);
    expect(Number(page.summary.maxPriceNaira)).toBe(450_000_000);
  });

  test("a LIVE unit never exposes an unapproved parent development", async () => {
    const r = await realtor("+2348050000095");
    const d = await r.developments.create(dev);
    const created = await r.listings.create({ ...unit("public-check"), developmentId: d.id });
    await db.listing.update({ where: { id: created.listing.id }, data: { status: "LIVE", publishedAt: new Date() } });
    const publicListing = await r.listings.byId({ id: created.listing.id });
    expect(publicListing.development).toBeNull();
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348050000096" });
    await admin.admin.reviewDevelopment({ id: d.id, decision: "APPROVED" });
    const approvedListing = await r.listings.byId({ id: created.listing.id });
    expect(approvedListing.development?.id).toBe(d.id);
  });

  test("a development with nothing available isn't listed publicly", async () => {
    const r = await realtor("+2348050000008");
    await r.developments.create(dev);
    expect(await r.developments.list()).toHaveLength(0);
  });

  test("only a valid YouTube link is accepted for a development film", async () => {
    const r = await realtor("+2348050000009");
    await expect(r.developments.create({ ...dev, youtubeUrl: "https://vimeo.com/123456789" })).rejects.toThrow(/YouTube/);
    const d = await r.developments.create({ ...dev, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" });
    expect(d.status).toBe("PENDING");
    expect(d.youtubeVideoId).toBe("dQw4w9WgXcQ");
  });
});
