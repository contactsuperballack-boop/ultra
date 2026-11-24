import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { rateLimit } from "../lib/rateLimit";

export const supportRouter = router({
  create: protectedProcedure.input(z.object({
    subject: z.string().trim().min(5).max(160),
    description: z.string().trim().min(10).max(5000),
    category: z.enum(["ACCOUNT", "LISTING", "PAYMENT", "INSPECTION", "HOME_SERVICES", "SAFETY_OR_FRAUD", "OTHER"]).default("OTHER"),
  })).mutation(async ({ ctx, input }) => {
    await rateLimit({ scope: "support-ticket-create", identifier: ctx.userId!, limit: 3, windowSeconds: 3600 });
    return ctx.db.supportTicket.create({
    data: { ...input, requesterId: ctx.userId! },
    select: { id: true, subject: true, status: true, priority: true, category: true, createdAt: true },
    });
  }),

  mine: protectedProcedure.query(async ({ ctx }) => ctx.db.supportTicket.findMany({
    where: { requesterId: ctx.userId! }, orderBy: { updatedAt: "desc" }, take: 50,
    select: { id: true, subject: true, category: true, priority: true, status: true, createdAt: true, updatedAt: true,
      messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, select: { id: true, authorId: true, body: true, createdAt: true } } },
  })),

  reply: protectedProcedure.input(z.object({ ticketId: z.string(), body: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
    const ticket = await ctx.db.supportTicket.findFirst({ where: { id: input.ticketId, requesterId: ctx.userId! } });
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Support ticket not found." });
    if (["RESOLVED", "CLOSED"].includes(ticket.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This ticket is closed. Open a new ticket if you still need help." });
    await rateLimit({ scope: "support-ticket-reply", identifier: ctx.userId!, limit: 15, windowSeconds: 600 });
    return ctx.db.$transaction(async (tx) => {
      const message = await tx.supportTicketMessage.create({ data: { ticketId: ticket.id, authorId: ctx.userId!, body: input.body } });
      await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });
      return message;
    });
  }),
});
