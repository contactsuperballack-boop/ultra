import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, superAdminProcedure } from "../trpc";
import { PUBLIC_REALTOR_PROFILE_SELECT, PUBLIC_PROVIDER_PROFILE_SELECT } from "../lib/safeProjections";

/**
 * Priority-checklist fix (MVP Product Readiness Audit — "the single
 * clearest 'the business can't practically run this yet' finding"):
 * realtors.adminSearch and providers.adminSearch already existed, but
 * neither covers a plain BUYER (no profile to search against), and
 * neither is reachable from a general admin screen — only
 * admin/payments/page.tsx calls them, for the narrow purpose of finding
 * a realtor/provider to issue a refund to. If a buyer contacts support
 * with "delete my data" or a fraud report about another user, there was
 * no admin tool to find that person at all.
 *
 * This router is intentionally new rather than added to realtors.ts or
 * providers.ts — it searches the User table directly, which isn't
 * specific to either domain, and giving it its own small router keeps
 * "find any account, any role" as one clear capability rather than a
 * third near-duplicate of the existing two searches. The two existing
 * role-specific searches are left exactly as they are (still used by
 * admin/payments for their existing purpose) — this doesn't replace
 * them, it closes the gap they don't cover.
 */
export const adminRouter = router({
  // Operational command-centre metrics. These are live database counts, not
  // extrapolated business KPIs; monetary totals include only recorded ledger rows.
  operationsOverview: adminProcedure.input(z.object({ days: z.number().int().min(7).max(90).default(30) }).optional()).query(async ({ ctx, input }) => {
    const since = new Date(Date.now() - (input?.days ?? 30) * 24 * 60 * 60 * 1000);
    const [users, newUsers, listings, pendingListings, developmentsPending, openReports, openTickets, inquiries, inspections, serviceRequests, payments, eventTypes, recentAudit, userRoles, listingStatuses, inspectionStatuses, serviceRequestStatuses, ticketStatuses] = await Promise.all([
      ctx.db.user.count(),
      ctx.db.user.count({ where: { createdAt: { gte: since } } }),
      ctx.db.listing.count(),
      ctx.db.listing.count({ where: { status: "PENDING_REVIEW" } }),
      ctx.db.development.count({ where: { status: "PENDING" } }),
      ctx.db.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
      ctx.db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] as const } } }),
      ctx.db.inquiry.count({ where: { createdAt: { gte: since } } }),
      ctx.db.inspectionRequest.count({ where: { createdAt: { gte: since } } }),
      ctx.db.serviceRequest.count({ where: { createdAt: { gte: since } } }),
      ctx.db.paymentTransaction.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { amountNaira: true } }),
      ctx.db.analyticsEvent.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { type: "desc" } }, take: 12 }),
      ctx.db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, actorUserId: true, action: true, targetType: true, targetId: true, createdAt: true } }),
      ctx.db.user.groupBy({ by: ["role"], _count: { _all: true } }),
      ctx.db.listing.groupBy({ by: ["status"], _count: { _all: true } }),
      ctx.db.inspectionRequest.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      ctx.db.serviceRequest.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      ctx.db.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return { periodDays: input?.days ?? 30, users, newUsers, listings, pendingListings, developmentsPending, openReports, openTickets, inquiries, inspections, serviceRequests,
      payments: payments.map((p) => ({ status: p.status, count: p._count._all, amountNaira: p._sum.amountNaira ?? 0n })),
      eventTypes: eventTypes.map((e) => ({ type: e.type, count: e._count._all })), recentAudit,
      breakdowns: { userRoles: userRoles.map((e) => ({ label: e.role, count: e._count._all })), listingStatuses: listingStatuses.map((e) => ({ label: e.status, count: e._count._all })), inspectionStatuses: inspectionStatuses.map((e) => ({ label: e.status, count: e._count._all })), serviceRequestStatuses: serviceRequestStatuses.map((e) => ({ label: e.status, count: e._count._all })), ticketStatuses: ticketStatuses.map((e) => ({ label: e.status, count: e._count._all })) } };
  }),

  adminAssignees: adminProcedure.query(async ({ ctx }) => ctx.db.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deactivatedAt: null }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })),

  supportQueue: adminProcedure.input(z.object({ status: z.enum(["ACTIVE", "OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED", "ALL"]).default("ACTIVE"), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(), cursor: z.string().nullish(), limit: z.number().int().min(1).max(50).default(25) }).optional()).query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 25;
    const items = await ctx.db.supportTicket.findMany({
      where: { ...(input?.status === "ACTIVE" ? { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] as const } } : input?.status && input.status !== "ALL" ? { status: input.status } : {}), ...(input?.priority ? { priority: input.priority } : {}) },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: limit + 1,
      ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: { requester: { select: { id: true, name: true, phone: true, email: true, role: true } }, messages: { orderBy: { createdAt: "asc" }, take: 30, include: { author: { select: { id: true, name: true, role: true } } } } },
    });
    let nextCursor: string | undefined;
    if (items.length > limit) nextCursor = items.pop()!.id;
    return { items, nextCursor };
  }),

  updateSupportTicket: adminProcedure.input(z.object({ ticketId: z.string(), status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(), assignedAdminId: z.string().nullable().optional(), resolutionNote: z.string().trim().max(3000).nullable().optional(), reply: z.string().trim().min(1).max(5000).optional(), internalNote: z.string().trim().min(1).max(5000).optional() }).refine((v) => Object.keys(v).some((k) => k !== "ticketId"), "At least one update is required.").refine((v) => !["RESOLVED", "CLOSED"].includes(v.status ?? "") || (v.resolutionNote?.trim().length ?? 0) >= 5, { message: "A resolution note of at least 5 characters is required to resolve or close a ticket.", path: ["resolutionNote"] })).mutation(async ({ ctx, input }) => {
    const current = await ctx.db.supportTicket.findUnique({ where: { id: input.ticketId } });
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Support ticket not found." });
    if (input.assignedAdminId) {
      const assignee = await ctx.db.user.findFirst({ where: { id: input.assignedAdminId, role: { in: ["ADMIN", "SUPER_ADMIN"] }, deactivatedAt: null }, select: { id: true } });
      if (!assignee) throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee must be an active administrator." });
    }
    const { reply, internalNote, ...changes } = input;
    const data: any = { ...changes };
    delete data.ticketId;
    if (changes.status === "RESOLVED" || changes.status === "CLOSED") data.resolvedAt = new Date();
    if (changes.status && !["RESOLVED", "CLOSED"].includes(changes.status)) data.resolvedAt = null;
    return ctx.db.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({ where: { id: input.ticketId }, data });
      if (reply) await tx.supportTicketMessage.create({ data: { ticketId: input.ticketId, authorId: ctx.userId!, body: reply } });
      if (internalNote) await tx.supportTicketMessage.create({ data: { ticketId: input.ticketId, authorId: ctx.userId!, body: internalNote, internal: true } });
      const auditChanges = { ...changes, ...(reply ? { reply: "[customer reply added]" } : {}), ...(internalNote ? { internalNote: "[internal note added]" } : {}) };
      await tx.adminAuditLog.create({ data: { actorUserId: ctx.userId!, action: "SUPPORT_TICKET_UPDATED", targetType: "SupportTicket", targetId: input.ticketId, metadata: { changes: auditChanges, previousStatus: current.status, previousPriority: current.priority, previousAssignee: current.assignedAdminId } } });
      return updated;
    });
  }),
  // Lean, list-shaped results — deliberately not the full profile detail
  // (see userDetail below) so a search-as-you-type screen doesn't pull
  // KYC-adjacent data for every row, only for the one an admin opens.
  search: adminProcedure.input(z.object({ query: z.string().min(2) })).query(async ({ ctx, input }) => {
    const users = await ctx.db.user.findMany({
      where: {
        OR: [{ name: { contains: input.query, mode: "insensitive" } }, { phone: { contains: input.query } }],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        phoneVerified: true,
        role: true,
        deactivatedAt: true,
        createdAt: true,
        realtorProfile: { select: { id: true, verificationStatus: true } },
        providerProfile: { select: { id: true, verificationStatus: true } },
      },
      take: 15,
      orderBy: { createdAt: "desc" },
    });
    return users;
  }),

  // Full detail for one account — the screen an admin actually opens
  // after finding someone via search. Realtor/provider info uses the
  // same safe projection the public-facing endpoints use, plus a couple
  // of admin-relevant fields (balance/commission owed) that are
  // appropriate for an admin to see but were correctly excluded from the
  // public projection — mirroring the exact pattern payments.failedLeadFees
  // already established for "safe projection plus one admin-only extra."
  // Super-admin only: create a new admin identity or promote an existing buyer.
  // Existing REALTOR/PROVIDER/SUPER_ADMIN accounts cannot be silently repurposed.
  createAdmin: superAdminProcedure
    .input(z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().regex(/^\+234\d{10}$/, "Phone must be in +234XXXXXXXXXX format") }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { phone: input.phone } });
      if (existing && existing.role !== "BUYER") {
        throw new TRPCError({ code: "CONFLICT", message: "This phone number already belongs to a non-buyer account." });
      }
      if (existing?.deactivatedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "A deactivated account cannot be promoted." });
      }
      const result = await ctx.db.$transaction(async (tx) => {
        const user = existing
          ? await tx.user.update({ where: { id: existing.id }, data: { name: input.name, role: "ADMIN" } })
          : await tx.user.create({ data: { name: input.name, phone: input.phone, role: "ADMIN" } });
        await tx.adminAuditLog.create({ data: { actorUserId: ctx.userId!, action: existing ? "ADMIN_PROMOTED" : "ADMIN_CREATED", targetType: "User", targetId: user.id, metadata: { phone: user.phone, role: "ADMIN" } } });
        return { id: user.id, name: user.name, phone: user.phone, role: user.role };
      });
      return result;
    }),

  // Only an ADMIN can be demoted; super-admin identities are never modified here.
  demoteAdmin: superAdminProcedure
    .input(z.object({ userId: z.string(), reason: z.string().trim().min(5).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot demote your own account." });
      const target = await ctx.db.user.findUnique({ where: { id: input.userId } });
      if (!target || target.role !== "ADMIN") throw new TRPCError({ code: "NOT_FOUND", message: "Admin account not found." });
      const activeAdmins = await ctx.db.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deactivatedAt: null } });
      if (activeAdmins <= 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "At least one active administrator or super-admin must remain." });
      await ctx.db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: target.id }, data: { role: "BUYER" } });
        await tx.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.adminAuditLog.create({ data: { actorUserId: ctx.userId!, action: "ADMIN_DEMOTED", targetType: "User", targetId: target.id, metadata: { reason: input.reason, previousRole: "ADMIN", newRole: "BUYER" } } });
      });
      return { success: true };
    }),

  listAdmins: superAdminProcedure.query(async ({ ctx }) => ctx.db.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, phone: true, role: true, deactivatedAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })),

  auditLogs: superAdminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ ctx, input }) => ctx.db.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" }, take: input?.limit ?? 50,
  })),

  developmentQueue: adminProcedure.input(z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING") }).optional()).query(async ({ ctx, input }) => ctx.db.development.findMany({
    where: { status: input?.status ?? "PENDING" }, orderBy: { createdAt: "asc" },
    include: { realtorProfile: { select: { id: true, agencyName: true, user: { select: { name: true, phone: true } } } }, listings: { select: { id: true, title: true, status: true } } },
  })),

  reviewDevelopment: adminProcedure.input(z.object({ id: z.string(), decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(1000).optional() }).refine((v) => v.decision !== "REJECTED" || (v.note?.length ?? 0) >= 5, { message: "A rejection reason of at least 5 characters is required.", path: ["note"] })).mutation(async ({ ctx, input }) => {
    const development = await ctx.db.development.findUnique({ where: { id: input.id } });
    if (!development) throw new TRPCError({ code: "NOT_FOUND" });
    return ctx.db.$transaction(async (tx) => {
      const updated = await tx.development.update({ where: { id: input.id }, data: { status: input.decision, moderationNote: input.note ?? null, reviewedAt: new Date(), reviewedByAdminId: ctx.userId! } });
      await tx.adminAuditLog.create({ data: { actorUserId: ctx.userId!, action: `DEVELOPMENT_${input.decision}`, targetType: "Development", targetId: input.id, metadata: { note: input.note ?? null, previousStatus: development.status } } });
      return updated;
    });
  }),

  userDetail: adminProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        phoneVerified: true,
        email: true,
        role: true,
        deactivatedAt: true,
        deactivationReason: true,
        createdAt: true,
        pushToken: true,
        realtorProfile: { select: { ...PUBLIC_REALTOR_PROFILE_SELECT, creditBalanceNaira: true, restrictedReason: true } },
        // ProviderProfile has no restrictedReason field (confirmed against
        // the schema — that restrict-account mechanism currently only
        // exists for realtors, not providers; noting the asymmetry here
        // rather than silently working around it or inventing a field).
        providerProfile: { select: { ...PUBLIC_PROVIDER_PROFILE_SELECT, commissionOwedNaira: true } },
        _count: {
          select: {
            inquiriesSent: true,
            savedListings: true,
            serviceRequestsSent: true,
            reportsFiled: true,
          },
        },
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return user;
  }),
});
