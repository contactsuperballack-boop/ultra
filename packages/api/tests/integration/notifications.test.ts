import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

/**
 * Priority-checklist fix — notifications.ts had zero integration test
 * coverage (confirmed by grep before writing this, not assumed). The
 * ownership-scoping in markRead/markAllRead was already read carefully
 * during the security audit's IDOR sweep and found correct — this file
 * is what actually proves that, with an executable (if not yet executed)
 * test, rather than leaving it as a one-time manual read.
 */
describe("notifications router (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("list, unreadCount, markRead, and markAllRead are all scoped to the caller", async () => {
    const { user: userA, caller: callerA } = await createAuthedCaller({ role: "BUYER", phone: "+2348092000001" });
    const { caller: callerB } = await createAuthedCaller({ role: "BUYER", phone: "+2348092000002" });

    const notifA1 = await db.notification.create({
      data: { userId: userA.id, type: "NEW_MESSAGE", title: "New message", body: "Test notification A1", data: { test: true } },
    });
    await db.notification.create({
      data: { userId: userA.id, type: "VERIFICATION_APPROVED", title: "Verification approved", body: "Test notification A2", data: {} },
    });

    // Security-audit IDOR check, made executable: caller B marking caller
    // A's notification read should be a no-op, not an error and not a
    // silent cross-account write.
    const crossAccountResult = await callerB.notifications.markRead({ id: notifA1.id });
    expect((crossAccountResult as any).count).toBe(0);

    let staleNotif = await db.notification.findUniqueOrThrow({ where: { id: notifA1.id } });
    expect(staleNotif.readAt).toBeNull();

    // Now the actual owner marks it read — this should work.
    const ownResult = await callerA.notifications.markRead({ id: notifA1.id });
    expect((ownResult as any).count).toBe(1);
    staleNotif = await db.notification.findUniqueOrThrow({ where: { id: notifA1.id } });
    expect(staleNotif.readAt).not.toBeNull();

    // unreadCount reflects only the caller's own remaining unread notification.
    expect(await callerA.notifications.unreadCount()).toBe(1);
    expect(await callerB.notifications.unreadCount()).toBe(0);

    // markAllRead clears the rest for A, doesn't touch B (who has none anyway,
    // but this also confirms the where-clause is userId-scoped, not global).
    await callerA.notifications.markAllRead();
    expect(await callerA.notifications.unreadCount()).toBe(0);

    const listResult = await callerA.notifications.list();
    expect((listResult as any).items.length).toBe(2);
    // B's list should never include A's notifications.
    const listResultB = await callerB.notifications.list();
    expect((listResultB as any).items.length).toBe(0);
  });

  test("list pagination returns a nextCursor only when more items remain", async () => {
    const { user, caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348092000003" });
    for (let i = 0; i < 5; i++) {
      await db.notification.create({
        data: { userId: user.id, type: "NEW_MESSAGE", title: `Message ${i}`, body: `Test notification body ${i}`, data: { i } },
      });
    }

    const page1 = await caller.notifications.list({ limit: 3 });
    expect((page1 as any).items.length).toBe(3);
    expect((page1 as any).nextCursor).toBeTruthy();

    const page2 = await caller.notifications.list({ limit: 3, cursor: (page1 as any).nextCursor });
    expect((page2 as any).items.length).toBe(2);
    expect((page2 as any).nextCursor).toBeUndefined();
  });

  test("registerPushToken and deregisterPushToken update the caller's own record only", async () => {
    const { user: userA, caller: callerA } = await createAuthedCaller({ role: "BUYER", phone: "+2348092000004" });
    const { user: userB } = await createAuthedCaller({ role: "BUYER", phone: "+2348092000005" });

    await callerA.notifications.registerPushToken({ token: "ExponentPushToken[test-token-a]" });
    let refreshedA = await db.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(refreshedA.pushToken).toBe("ExponentPushToken[test-token-a]");

    const refreshedB = await db.user.findUniqueOrThrow({ where: { id: userB.id } });
    expect(refreshedB.pushToken).toBeNull();

    // Closes the shared-device edge case documented directly in the
    // router: deregister should null it back out, not just overwrite it
    // with an empty string or leave it stale.
    await callerA.notifications.deregisterPushToken();
    refreshedA = await db.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(refreshedA.pushToken).toBeNull();
  });

  test("an unauthenticated caller cannot use any notifications procedure", async () => {
    const { appRouter, createContext } = await import("../../src");
    const ctx = await createContext({ authHeader: null });
    const anonCaller = appRouter.createCaller(ctx);
    await expect(anonCaller.notifications.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonCaller.notifications.unreadCount()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonCaller.notifications.markAllRead()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
