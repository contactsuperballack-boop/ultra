import { beforeEach, describe, expect, test } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

describe("super-admin management and development moderation", () => {
  beforeEach(async () => resetDatabase());

  test("only super-admin can create admins and every change is audit logged", async () => {
    const { caller: regularAdmin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348060000001" });
    await expect(regularAdmin.admin.createAdmin({ name: "Second Admin", phone: "+2348060000010" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { caller: superAdmin } = await createAuthedCaller({ role: "SUPER_ADMIN", phone: "+2348060000002" });
    const created = await superAdmin.admin.createAdmin({ name: "Second Admin", phone: "+2348060000010" });
    expect(created.role).toBe("ADMIN");
    expect(await db.adminAuditLog.count({ where: { action: "ADMIN_CREATED", targetId: created.id } })).toBe(1);
  });

  test("demotion revokes refresh tokens and refuses self-demotion", async () => {
    const { caller: superAdmin, user: root } = await createAuthedCaller({ role: "SUPER_ADMIN", phone: "+2348060000003" });
    const { user: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348060000004" });
    await db.refreshToken.create({ data: { userId: admin.id, tokenHash: "test-refresh-hash", expiresAt: new Date(Date.now() + 60_000) } });
    await expect(superAdmin.admin.demoteAdmin({ userId: root.id, reason: "Testing self protection" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await superAdmin.admin.demoteAdmin({ userId: admin.id, reason: "Role no longer required" });
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe("BUYER");
    expect((await db.refreshToken.findFirstOrThrow({ where: { userId: admin.id } })).revokedAt).not.toBeNull();
    expect(await db.adminAuditLog.count({ where: { action: "ADMIN_DEMOTED", targetId: admin.id } })).toBe(1);
  });

  test("pending developments are hidden until admin approval; rejected developments stay private", async () => {
    const { caller: realtor } = await createAuthedCaller({ role: "REALTOR", phone: "+2348060000005", realtor: { agencyName: "Pilot Realty" } });
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348060000006" });
    const development = await realtor.developments.create({ name: "Pilot Estate", description: "A complete residential estate with modern shared amenities and controlled access for residents.", area: "Guzape" });
    expect(development.status).toBe("PENDING");
    expect(await realtor.developments.list()).toHaveLength(0);
    await expect(realtor.developments.byId({ id: development.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await admin.admin.reviewDevelopment({ id: development.id, decision: "REJECTED", note: "Insufficient supporting details" });
    await expect(realtor.developments.byId({ id: development.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.adminAuditLog.count({ where: { action: "DEVELOPMENT_REJECTED", targetId: development.id } })).toBe(1);
  });
  test("editing an approved development sends it back through moderation", async () => {
    const { caller: realtor } = await createAuthedCaller({ role: "REALTOR", phone: "+2348060000011", realtor: { agencyName: "Review Loop Realty" } });
    const { caller: admin } = await createAuthedCaller({ role: "ADMIN", phone: "+2348060000012" });
    const input = { name: "Reviewed Estate", description: "A residential development with shared amenities, managed access and clearly documented unit specifications.", area: "Jabi" };
    const dev = await realtor.developments.create(input);
    await admin.admin.reviewDevelopment({ id: dev.id, decision: "APPROVED" });
    await realtor.developments.update({ id: dev.id, data: { ...input, description: "Updated description with additional claims and specifications that need a fresh review." } });
    const changed = await db.development.findUniqueOrThrow({ where: { id: dev.id } });
    expect(changed.status).toBe("PENDING");
    expect(changed.reviewedAt).toBeNull();
    await expect(realtor.developments.byId({ id: dev.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

});
