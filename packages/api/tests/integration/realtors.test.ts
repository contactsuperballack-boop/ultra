import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

describe("realtor verification (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("a non-admin cannot approve a realtor application", async () => {
    const pendingRealtor = await db.user.create({
      data: { phone: "+2348030000002", phoneVerified: true, name: "Pending Realtor", role: "REALTOR",
        realtorProfile: { create: { agencyName: "Pending Co", verificationStatus: "PENDING_REVIEW" } } },
      include: { realtorProfile: true },
    });

    const { caller: buyerCaller } = await createAuthedCaller({ role: "BUYER", phone: "+2348030000003" });
    await expect(
      buyerCaller.realtors.adminSetVerificationStatus({ realtorProfileId: pendingRealtor.realtorProfile!.id, status: "VERIFIED" })
    ).rejects.toThrow(/Admin access required/);
  });

  test("an admin approving a realtor sets VERIFIED, logs it, and notifies the realtor", async () => {
    const pendingRealtor = await db.user.create({
      data: { phone: "+2348030000004", phoneVerified: true, name: "Pending Realtor 2", role: "REALTOR",
        realtorProfile: { create: { agencyName: "Pending Co 2", verificationStatus: "PENDING_REVIEW" } } },
      include: { realtorProfile: true },
    });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348030000005" });
    await adminCaller.realtors.adminSetVerificationStatus({
      realtorProfileId: pendingRealtor.realtorProfile!.id,
      status: "VERIFIED",
      note: "ID and CAC documents check out.",
    });

    const updated = await db.realtorProfile.findUniqueOrThrow({ where: { id: pendingRealtor.realtorProfile!.id } });
    expect(updated.verificationStatus).toBe("VERIFIED");
    expect(updated.verifiedAt).not.toBeNull();

    const log = await db.verificationLog.findFirst({ where: { realtorProfileId: pendingRealtor.realtorProfile!.id } });
    expect(log?.fromStatus).toBe("PENDING_REVIEW");
    expect(log?.toStatus).toBe("VERIFIED");
    expect(log?.note).toBe("ID and CAC documents check out.");

    const notification = await db.notification.findFirst({ where: { userId: pendingRealtor.id, type: "VERIFICATION_APPROVED" } });
    expect(notification).toBeTruthy();
  });

  test("a rejected realtor cannot then create a listing", async () => {
    const pendingRealtor = await db.user.create({
      data: { phone: "+2348030000006", phoneVerified: true, name: "Rejected Realtor", role: "REALTOR",
        realtorProfile: { create: { agencyName: "Rejected Co", verificationStatus: "PENDING_REVIEW" } } },
      include: { realtorProfile: true },
    });
    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348030000007" });
    await adminCaller.realtors.adminSetVerificationStatus({ realtorProfileId: pendingRealtor.realtorProfile!.id, status: "REJECTED" });

    const { signAccessToken } = await import("../../src/lib/tokens");
    const { appRouter, createContext } = await import("../../src");
    const token = signAccessToken({ sub: pendingRealtor.id, role: "REALTOR" });
    const ctx = await createContext({ authHeader: `Bearer ${token}` });
    const rejectedCaller = appRouter.createCaller(ctx);

    await expect(
      rejectedCaller.listings.create({
        title: "Should fail", description: "Rejected realtors should not be able to publish listings, period.",
        type: "SALE", priceNaira: 100_000_000, area: "Jabi", sizeSqm: 300, photos: [{ url: "https://example.com/x.jpg" }],
      })
    ).rejects.toThrow(/Verified realtor/);
  });

  test("pendingApplications only returns PENDING_REVIEW profiles, not VERIFIED or REJECTED ones", async () => {
    await createAuthedCaller({ role: "REALTOR", phone: "+2348030000008", realtor: { agencyName: "Already Verified Co" } }); // VERIFIED via helper
    await db.user.create({
      data: { phone: "+2348030000009", phoneVerified: true, name: "Still Pending", role: "REALTOR",
        realtorProfile: { create: { agencyName: "Still Pending Co", verificationStatus: "PENDING_REVIEW" } } },
    });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348030000010" });
    const queue = await adminCaller.realtors.pendingApplications({});

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0].agencyName).toBe("Still Pending Co");
  });

  test("approving a realtor application promotes User.role from BUYER to REALTOR", async () => {
    // Deliberately does NOT pre-set role: "REALTOR" on the fixture, unlike
    // every other test in this file — this is the actual bug that was
    // found and fixed: every real signup defaults to BUYER, and nothing
    // was ever promoting it, even after full verification. A test fixture
    // that pre-sets the role would never have caught that.
    const applicant = await db.user.create({
      data: { phone: "+2348030000011", phoneVerified: true, name: "New Applicant", role: "BUYER",
        realtorProfile: { create: { agencyName: "New Applicant Realty", verificationStatus: "PENDING_REVIEW" } } },
      include: { realtorProfile: true },
    });
    expect(applicant.role).toBe("BUYER"); // sanity check on the starting state

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348030000012" });
    await adminCaller.realtors.adminSetVerificationStatus({ realtorProfileId: applicant.realtorProfile!.id, status: "VERIFIED" });

    const updated = await db.user.findUniqueOrThrow({ where: { id: applicant.id } });
    expect(updated.role).toBe("REALTOR");
  });

  test("rejecting an application does NOT change User.role", async () => {
    const applicant = await db.user.create({
      data: { phone: "+2348030000013", phoneVerified: true, name: "Rejected Applicant", role: "BUYER",
        realtorProfile: { create: { agencyName: "Rejected Applicant Co", verificationStatus: "PENDING_REVIEW" } } },
      include: { realtorProfile: true },
    });

    const { caller: adminCaller } = await createAuthedCaller({ role: "ADMIN", phone: "+2348030000014" });
    await adminCaller.realtors.adminSetVerificationStatus({ realtorProfileId: applicant.realtorProfile!.id, status: "REJECTED" });

    const updated = await db.user.findUniqueOrThrow({ where: { id: applicant.id } });
    expect(updated.role).toBe("BUYER"); // unchanged — a rejected applicant keeps their existing role
  });
});
