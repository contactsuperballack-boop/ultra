import { describe, test, expect, beforeEach } from "vitest";
import { db } from "@ultra/db";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

describe("Stage 09 admin operations and support (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => { await resetDatabase(); });

  test("customers can create and view only their own support tickets", async () => {
    const { caller: customer } = await createAuthedCaller({ role: "BUYER", phone: "+2348067090001" });
    const { caller: other } = await createAuthedCaller({ role: "BUYER", phone: "+2348067090002" });
    const ticket = await customer.support.create({ subject: "Payment confirmation missing", description: "I completed a payment but the transaction is still pending in my account.", category: "PAYMENT" });
    expect(ticket.status).toBe("OPEN");
    expect((await customer.support.mine()).map((t) => t.id)).toContain(ticket.id);
    expect(await other.support.mine()).toHaveLength(0);
    await expect(other.support.reply({ ticketId: ticket.id, body: "Please help me." })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("admins can triage, reply and audit a support ticket", async () => {
    const { caller: customer } = await createAuthedCaller({ role: "BUYER", phone: "+2348067090011" });
    const { caller: admin, user: adminUser } = await createAuthedCaller({ role: "ADMIN", phone: "+2348067090012" });
    const ticket = await customer.support.create({ subject: "Unable to book inspection", description: "The inspection request form fails after I choose a date.", category: "INSPECTION" });
    const updated = await admin.admin.updateSupportTicket({ ticketId: ticket.id, status: "IN_PROGRESS", priority: "HIGH", assignedAdminId: adminUser.id, reply: "We are reviewing the booking issue.", internalNote: "Reproduced in Chrome; route to web team." });
    expect(updated.status).toBe("IN_PROGRESS");
    const queue = await admin.admin.supportQueue({ status: "IN_PROGRESS" });
    expect(queue.items[0]?.id).toBe(ticket.id);
    expect(queue.items[0]?.messages.some((m) => m.body.includes("reviewing"))).toBe(true);
    expect(queue.items[0]?.messages.some((m) => m.internal && m.body.includes("Reproduced"))).toBe(true);
    expect((await customer.support.mine())[0]?.messages.some((m) => m.body.includes("Reproduced"))).toBe(false);
    expect(await db.adminAuditLog.count({ where: { targetType: "SupportTicket", targetId: ticket.id, action: "SUPPORT_TICKET_UPDATED" } })).toBe(1);
    expect((await customer.support.mine())[0]?.messages.some((m) => m.body.includes("reviewing"))).toBe(true);
  });

  test("buyers cannot access admin analytics or support queue", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348067090021" });
    await expect(caller.admin.operationsOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.supportQueue()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
