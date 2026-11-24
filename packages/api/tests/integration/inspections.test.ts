import { describe, test, expect, beforeEach } from "vitest";
import { db, todayInNigeria } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

const baseListing = {
  title: "Inspection test home",
  description: "A well-finished property in a quiet part of Abuja, with enough text to pass validation.",
  type: "SALE" as const,
  category: "RESIDENTIAL" as const,
  area: "Maitama",
  sizeSqm: 1000,
  priceNaira: 500_000_000,
  photos: [{ url: "https://example.com/p.jpg" }],
};

const inDays = (n: number) => {
  const d = new Date(`${todayInNigeria()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe("inspection requests (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function setup() {
    const { caller: realtor } = await createAuthedCaller({ role: "REALTOR", phone: "+2348040000001", realtor: { agencyName: "Viewing Realty" } });
    const { caller: buyer } = await createAuthedCaller({ role: "BUYER", phone: "+2348040000002" });
    const { listing } = await realtor.listings.create(baseListing);
    await db.listing.update({ where: { id: listing.id }, data: { status: "LIVE", publishedAt: new Date() } });
    return { realtor, buyer, listing };
  }

  test("the first request creates the inquiry thread, the request and a notification", async () => {
    const { buyer, listing } = await setup();
    const req = await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "MORNING", notes: "Bringing my surveyor." });
    expect(req.status).toBe("REQUESTED");
    const thread = await db.inquiry.findMany({ where: { listingId: listing.id } });
    expect(thread).toHaveLength(1);
    const msgs = await db.message.findMany({ where: { inquiryId: thread[0].id } });
    expect(msgs[0].body).toMatch(/Visit in person requested/);
    expect(await db.notification.count({ where: { type: "INSPECTION_REQUESTED" } })).toBe(1);
  });

  test("buyer inspection dashboard returns only the caller's requests with permitted actions", async () => {
    const { buyer, listing } = await setup();
    const request = await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "MORNING" });
    const { caller: otherBuyer } = await createAuthedCaller({ role: "BUYER", phone: "+2348040000010" });

    const mine = await buyer.inspections.mine();
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(request.id);
    expect(mine[0].listing.id).toBe(listing.id);
    expect(mine[0].actions).toContain("CANCEL");
    expect((await otherBuyer.inspections.mine())).toHaveLength(0);
  });

  test("a second request on the same listing reuses the thread (no second lead)", async () => {
    const { buyer, listing } = await setup();
    await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "MORNING" });
    await buyer.inspections.request({ listingId: listing.id, kind: "VIRTUAL", preferredDate: inDays(4), slot: "EVENING" });
    expect(await db.inquiry.count({ where: { listingId: listing.id } })).toBe(1);
    expect(await db.inspectionRequest.count({ where: { listingId: listing.id } })).toBe(2);
  });

  test("dates: today, the past and beyond 90 days are rejected", async () => {
    const { buyer, listing } = await setup();
    for (const d of [todayInNigeria(), inDays(-2), inDays(91), "2026-02-31"]) {
      await expect(buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: d, slot: "MORNING" })).rejects.toThrow();
    }
  });

  test("a realtor can't request an inspection of their own listing", async () => {
    const { realtor, listing } = await setup();
    await expect(realtor.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "MORNING" })).rejects.toThrow(/own listing/);
  });

  test("no more than three open requests per buyer per listing", async () => {
    const { buyer, listing } = await setup();
    for (const n of [2, 3, 4]) await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(n), slot: "MORNING" });
    await expect(buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(5), slot: "MORNING" })).rejects.toThrow(/several open requests/);
  });

  test("the realtor accepts; the buyer can't accept for them", async () => {
    const { realtor, buyer, listing } = await setup();
    const req = await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "AFTERNOON" });
    await expect(buyer.inspections.transition({ id: req.id, action: "ACCEPT" })).rejects.toThrow(/can't take that action/);
    const accepted = await realtor.inspections.transition({ id: req.id, action: "ACCEPT" });
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.scheduledSlot).toBe("AFTERNOON");
    expect(await db.notification.count({ where: { type: "INSPECTION_UPDATED" } })).toBe(1);
  });

  test("reschedule: the realtor proposes, the buyer accepts, and the agreed time replaces the old one", async () => {
    const { realtor, buyer, listing } = await setup();
    const req = await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "MORNING" });
    await expect(realtor.inspections.transition({ id: req.id, action: "RESCHEDULE" })).rejects.toThrow(/new date/);
    const proposed = await realtor.inspections.transition({ id: req.id, action: "RESCHEDULE", proposedDate: inDays(6), proposedSlot: "EVENING" });
    expect(proposed.status).toBe("RESCHEDULE_PROPOSED");
    await expect(realtor.inspections.transition({ id: req.id, action: "ACCEPT_RESCHEDULE" })).rejects.toThrow();
    const done = await buyer.inspections.transition({ id: req.id, action: "ACCEPT_RESCHEDULE" });
    expect(done.status).toBe("ACCEPTED");
    expect(done.scheduledDate?.toISOString().slice(0, 10)).toBe(inDays(6));
    expect(done.proposedDate).toBeNull();
  });

  test("can't be marked complete before the day", async () => {
    const { realtor, buyer, listing } = await setup();
    const req = await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "MORNING" });
    await realtor.inspections.transition({ id: req.id, action: "ACCEPT" });
    await expect(realtor.inspections.transition({ id: req.id, action: "COMPLETE" })).rejects.toThrow(/on or after the day/);
  });

  test("only the buyer and that listing's realtor can read or change a request", async () => {
    const { buyer, listing } = await setup();
    const req = await buyer.inspections.request({ listingId: listing.id, kind: "PHYSICAL", preferredDate: inDays(3), slot: "MORNING" });
    const { caller: stranger } = await createAuthedCaller({ role: "BUYER", phone: "+2348040000009" });
    await expect(stranger.inspections.forInquiry({ inquiryId: req.inquiryId })).rejects.toThrow();
    await expect(stranger.inspections.transition({ id: req.id, action: "CANCEL" })).rejects.toThrow();
    const { caller: otherRealtor } = await createAuthedCaller({ role: "REALTOR", phone: "+2348040000008", realtor: { agencyName: "Someone Else" } });
    await expect(otherRealtor.inspections.transition({ id: req.id, action: "ACCEPT" })).rejects.toThrow();
  });

  test("the buyer can cancel, and a cancelled request is final", async () => {
    const { realtor, buyer, listing } = await setup();
    const req = await buyer.inspections.request({ listingId: listing.id, kind: "VIRTUAL", preferredDate: inDays(3), slot: "MORNING" });
    expect((await buyer.inspections.transition({ id: req.id, action: "CANCEL" })).status).toBe("CANCELLED");
    await expect(realtor.inspections.transition({ id: req.id, action: "ACCEPT" })).rejects.toThrow();
  });
});
