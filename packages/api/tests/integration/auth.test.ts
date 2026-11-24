import { describe, test, expect, beforeEach } from "vitest";
import { appRouter, createContext } from "../../src";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

const PHONE = "+2348011112222";

async function anonCaller() {
  const ctx = await createContext({ authHeader: null });
  return appRouter.createCaller(ctx);
}

describe("auth flow (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("requestOtp → verifyOtp creates a user and returns valid tokens", async () => {
    const caller = await anonCaller();

    const otpResult = await caller.auth.requestOtp({ phone: PHONE });
    // _testOnlyCode only exists because NODE_ENV=test — see auth.ts.
    const code = (otpResult as any)._testOnlyCode;
    expect(code).toBeTruthy();
    expect(code).toHaveLength(6);

    const verifyResult = await caller.auth.verifyOtp({ phone: PHONE, code, name: "Test User" });
    expect(verifyResult.accessToken).toBeTruthy();
    expect(verifyResult.refreshToken).toBeTruthy();
    expect(verifyResult.user.phone).toBe(PHONE);
    expect(verifyResult.user.phoneVerified).toBe(true);
  });

  test("wrong code is rejected and does not create a session", async () => {
    const caller = await anonCaller();
    await caller.auth.requestOtp({ phone: PHONE });

    await expect(caller.auth.verifyOtp({ phone: PHONE, code: "000000" })).rejects.toThrow();
  });

  test("exceeding MAX_OTP_ATTEMPTS locks out further attempts on that code", async () => {
    const caller = await anonCaller();
    await caller.auth.requestOtp({ phone: PHONE });

    // 5 wrong attempts (MAX_OTP_ATTEMPTS), then a 6th should hit the
    // TOO_MANY_REQUESTS path even before checking the code value.
    for (let i = 0; i < 5; i++) {
      await expect(caller.auth.verifyOtp({ phone: PHONE, code: "000000" })).rejects.toThrow();
    }
    await expect(caller.auth.verifyOtp({ phone: PHONE, code: "000000" })).rejects.toThrow(/Too many/);
  });

  test("requesting a second OTP within the cooldown window is rejected", async () => {
    const caller = await anonCaller();
    await caller.auth.requestOtp({ phone: PHONE });
    await expect(caller.auth.requestOtp({ phone: PHONE })).rejects.toThrow();
  });

  test("refresh rotates the token — the old refresh token can't be reused after rotation", async () => {
    const caller = await anonCaller();
    const otpResult = await caller.auth.requestOtp({ phone: PHONE });
    const { refreshToken: firstRefresh } = await caller.auth.verifyOtp({
      phone: PHONE,
      code: (otpResult as any)._testOnlyCode,
    });

    const { refreshToken: secondRefresh } = await caller.auth.refresh({ refreshToken: firstRefresh });
    expect(secondRefresh).not.toBe(firstRefresh);

    // The rotated-out token should now be rejected.
    await expect(caller.auth.refresh({ refreshToken: firstRefresh })).rejects.toThrow();
  });

  // Execution Plan, Sprint 4 — this was an explicitly flagged gap: "no
  // tests were added for the refresh-token concurrency logic... easy to
  // get subtly wrong and hard to verify by reading alone." Writing this
  // test is what surfaced that auth.refresh had the same check-then-act
  // race already fixed in serviceRequests.complete (Sprint 1) — two
  // concurrent calls presenting the same token could both pass the
  // pre-check before either committed. Fixed in auth.ts with the same
  // atomic-updateMany pattern; this test is what would catch a regression
  // back to the old shape.
  test("two concurrent refresh() calls with the same token: exactly one succeeds", async () => {
    const caller = await anonCaller();
    const otpResult = await caller.auth.requestOtp({ phone: PHONE });
    const { refreshToken } = await caller.auth.verifyOtp({ phone: PHONE, code: (otpResult as any)._testOnlyCode });

    const results = await Promise.allSettled([
      caller.auth.refresh({ refreshToken }),
      caller.auth.refresh({ refreshToken }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  test("a protected procedure rejects an unauthenticated caller", async () => {
    const caller = await anonCaller();
    await expect(caller.auth.me()).rejects.toThrow(/Sign in required/);
  });

  // Execution Plan, Sprint 9 — the account-deletion flow this sprint
  // added. Checks the full contract: sessions killed, PII redacted per
  // docs/DATA_RETENTION.md, live listings taken down, and re-login blocked
  // rather than silently reactivating the account.
  test("requestAccountDeletion revokes sessions, redacts name, and removes live listings", async () => {
    const { caller, user } = await createAuthedCaller({
      role: "REALTOR",
      phone: "+2348060000001",
      realtor: { agencyName: "Deletion Test Realty", creditBalanceNaira: 5_000n },
    });
    const realtorProfile = await db.realtorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const listing = await db.listing.create({
      data: {
        realtorProfileId: realtorProfile.id,
        title: "A listing that should come down on account deletion",
        description: "Long enough description to pass validation for this integration test fixture.",
        type: "SALE",
        priceNaira: 100_000_000n,
        area: "Wuse",
        sizeSqm: 500,
        status: "LIVE",
      },
    });

    await caller.savedListings.toggle({ listingId: listing.id });
    await caller.savedSearches.create({ name: "Private saved search", type: "SALE", query: "Wuse" });
    await caller.auth.requestAccountDeletion({ reason: "Testing" });

    expect(await db.savedListing.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.savedSearch.count({ where: { userId: user.id } })).toBe(0);

    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.name).toBe("Deleted user");
    expect(updatedUser.deactivatedAt).not.toBeNull();

    const activeSessions = await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(activeSessions).toBe(0);

    const updatedListing = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(updatedListing.status).toBe("REMOVED");

    const anon = await anonCaller();
    const otpResult = await anon.auth.requestOtp({ phone: "+2348060000001" });
    await expect(
      anon.auth.verifyOtp({ phone: "+2348060000001", code: (otpResult as any)._testOnlyCode })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
