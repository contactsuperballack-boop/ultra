import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

 describe("Stage 08 communication controls", () => {
  beforeEach(async () => { await resetDatabase(); });

  test("notification channel preferences are private and default to push enabled", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348070080001" });
    await expect(caller.notifications.preferences()).resolves.toMatchObject({ push: true, email: false, sms: false, whatsapp: false });
    await caller.notifications.updatePreferences({ push: false });
    await expect(caller.notifications.preferences()).resolves.toMatchObject({ push: false });
  });

  test("provider cannot initiate a commission settlement larger than the outstanding balance", async () => {
    const { caller, user } = await createAuthedCaller({ role: "PROVIDER", phone: "+2348070080010", provider: { businessName: "Stage Eight Services" } });
    await db.providerProfile.update({ where: { userId: user.id }, data: { commissionOwedNaira: 2_500n } });
    await expect(caller.payments.settleCommission({ amountNaira: 2_501, email: "provider@example.com" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("buyer can mark only their own inquiry thread messages as read", async () => {
    const { caller: realtor, user: realtorUser } = await createAuthedCaller({ role: "REALTOR", phone: "+2348070080002", realtor: { agencyName: "Stage Eight Realty" } });
    const profile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: realtorUser.id } });
    const listing = await db.listing.create({ data: { realtorProfileId: profile.id, title: "Stage Eight Property", description: "A sufficiently long property description for this test fixture.", type: "SALE", priceNaira: 100_000_000n, area: "Maitama", sizeSqm: 500, status: "LIVE" } });
    const { caller: buyer, user: buyerUser } = await createAuthedCaller({ role: "BUYER", phone: "+2348070080003" });
    const inquiry = await buyer.inquiries.create({ listingId: listing.id, message: "Please share the inspection availability and full property details." });
    await realtor.inquiries.reply({ inquiryId: inquiry.id, message: "We can arrange an inspection this weekend." });
    await expect(buyer.inquiries.unreadCount()).resolves.toBe(1);
    await buyer.inquiries.markThreadRead({ inquiryId: inquiry.id });
    await expect(buyer.inquiries.unreadCount()).resolves.toBe(0);
    const outsider = await createAuthedCaller({ role: "BUYER", phone: "+2348070080004" });
    await expect(outsider.caller.inquiries.markThreadRead({ inquiryId: inquiry.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(buyerUser.id).not.toBe(realtorUser.id);
  });
});
