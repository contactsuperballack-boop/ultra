import { z } from "zod";
import { router, homeServicesProtectedProcedure, homeServicesVerifiedProviderProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { notify } from "../lib/notify";
import { rateLimit } from "../lib/rateLimit";
import { calculateCommissionNaira, getPlatformConfig } from "@ultra/db";
import { PUBLIC_PROVIDER_PROFILE_SELECT } from "../lib/safeProjections";
import { trackEvent } from "../lib/analytics";

const SERVICE_CATEGORIES = ["PAINTING", "PLUMBING", "FUMIGATION", "ELECTRICAL", "SOLAR", "CCTV", "SECURITY_SYSTEMS", "FURNITURE", "CLEANING", "MOVE_IN", "PEST_CONTROL"] as const;
const FREQUENCIES = ["WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY"] as const;

function nextServiceDate(date: Date, frequency: (typeof FREQUENCIES)[number]) {
  const next = new Date(date);
  if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "FORTNIGHTLY") next.setUTCDate(next.getUTCDate() + 14);
  else {
    // Clamp month-end visits (e.g. 31 January) to the last valid day of
    // the target month rather than allowing JS Date to overflow into March.
    const day = next.getUTCDate();
    const months = frequency === "MONTHLY" ? 1 : 3;
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  }
  return next;
}

export const serviceRequestsRouter = router({
  // Customer requests a provider. Unlike inquiries.create, this does NOT
  // bill anything at creation — Phase 2's monetization is commission on
  // completion (see `complete` below) plus provider subscriptions, not a
  // per-lead fee, so there's no billing-state reason to ever block a
  // customer's request from going through. The disintermediation risk
  // Blueprint §10/§12 describes for realtors applies here too, though: an
  // accepted job's actual payment happens off-platform (cash/transfer
  // between customer and provider), same as Phase 1 doesn't intermediate
  // full-price closings. What the platform DOES enforce is that the
  // *contact* stays in-app via ServiceMessage until both sides choose
  // otherwise, and that the provider self-reports completion + price,
  // which is what commission is computed against.
  create: homeServicesProtectedProcedure
    .input(
      z.object({
        providerProfileId: z.string(),
        offeringId: z.string().optional(),
        category: z.enum(SERVICE_CATEGORIES),
        transactionType: z.enum(["ONE_TIME", "INSTALLATION_PROJECT", "RECURRING"]).default("ONE_TIME"),
        unitCount: z.number().int().min(1).max(500).default(1),
        siteName: z.string().trim().min(2).max(120).optional(),
        siteAddress: z.string().trim().min(2).max(240).optional(),
        preferredAt: z.string().datetime().optional(),
        requestedFrequency: z.enum(FREQUENCIES).optional(),
        note: z.string().trim().min(10, "Add a bit more detail so the provider knows what the job involves.").max(1000),
      }).superRefine((input, ctx) => {
        if (input.unitCount > 1 && input.transactionType !== "INSTALLATION_PROJECT") {
          ctx.addIssue({ code: "custom", path: ["transactionType"], message: "Multiple units must be submitted as an installation project." });
        }
        if (input.unitCount > 1 && !input.siteName) {
          ctx.addIssue({ code: "custom", path: ["siteName"], message: "Add the estate or project site name for a bulk request." });
        }
        if (input.transactionType === "RECURRING" && !input.requestedFrequency) {
          ctx.addIssue({ code: "custom", path: ["requestedFrequency"], message: "Choose a preferred service frequency." });
        }
        if (input.transactionType !== "RECURRING" && input.requestedFrequency) {
          ctx.addIssue({ code: "custom", path: ["requestedFrequency"], message: "Frequency applies only to recurring service agreements." });
        }
        if (input.preferredAt && new Date(input.preferredAt).getTime() < Date.now()) {
          ctx.addIssue({ code: "custom", path: ["preferredAt"], message: "Choose a future preferred appointment time." });
        }
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.providerProfile.findUnique({ where: { id: input.providerProfileId } });
      if (!provider || provider.verificationStatus !== "VERIFIED") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found or not verified." });
      }
      if (provider.userId === ctx.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot request a service from your own provider account." });
      if (!provider.categories.includes(input.category)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This provider isn't verified for that category." });
      }

      // Remediation (Gate B #4): offeringId and category were previously
      // both client-supplied with no cross-check — a request could
      // reference an offering from a different provider entirely, a
      // different category than the one declared, or an offering that's
      // been paused since the customer loaded the page. All three are
      // validated here rather than trusted.
      if (input.offeringId) {
        const offering = await ctx.db.offering.findUnique({ where: { id: input.offeringId } });
        if (!offering || offering.providerProfileId !== input.providerProfileId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That offering doesn't belong to this provider." });
        }
        if (!offering.active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That offering is no longer available." });
        }
        if (offering.category !== input.category) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The offering's category doesn't match the request's category." });
        }
      }

      // Loose cap on request volume per customer per day — protects
      // providers from spam requests, same spirit as inquiries.create's
      // rate limit on new leads (though there's no per-request cost here
      // to a provider the way a lead fee costs a realtor).
      await rateLimit({ scope: "new-service-request", identifier: ctx.userId!, limit: 20, windowSeconds: 86_400 });

      const request = await ctx.db.serviceRequest.create({
        data: {
          customerId: ctx.userId!,
          providerProfileId: input.providerProfileId,
          offeringId: input.offeringId,
          category: input.category,
          transactionType: input.transactionType,
          unitCount: input.unitCount,
          siteName: input.siteName,
          siteAddress: input.siteAddress,
          preferredAt: input.preferredAt ? new Date(input.preferredAt) : undefined,
          requestedFrequency: input.requestedFrequency,
          note: input.note,
          messages: { create: { senderId: ctx.userId!, body: input.note } },
        },
        include: { messages: true },
      });

      await notify(ctx.db, {
        userId: provider.userId,
        type: "NEW_BOOKING_REQUEST",
        title: "New job request",
        body: input.note.slice(0, 120),
        data: { serviceRequestId: request.id },
      });

      // Optimization Sprint A.
      trackEvent(ctx.db, {
        type: "service_request_created",
        userId: ctx.userId,
        properties: { providerProfileId: input.providerProfileId, category: input.category },
      }).catch(() => {});

      return request;
    }),

  // Customer's own bookings.
  myRequests: homeServicesProtectedProcedure.query(async ({ ctx }) => {
    return ctx.db.serviceRequest.findMany({
      where: { customerId: ctx.userId! },
      include: {
        // Remediation (Phase 1 trust boundary repair, item 1): same leak
        // class as inquiries.myThreads — a customer never needs the
        // provider's commissionOwedNaira or KYC document URL.
        providerProfile: { select: { ...PUBLIC_PROVIDER_PROFILE_SELECT, user: { select: { name: true } } } },
        offering: true,
        quotes: { orderBy: { version: "desc" }, include: { milestones: { orderBy: { sortOrder: "asc" } } } },
        recurringAgreements: { orderBy: { version: "desc" }, include: { occurrences: { orderBy: { scheduledAt: "desc" } } } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Single-thread fetch with ownership check — mirrors inquiries.byId
  // exactly, checked against either side of a service request instead of
  // a listing.
  byId: homeServicesProtectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const request = await ctx.db.serviceRequest.findUnique({
      where: { id: input.id },
      include: {
        providerProfile: { select: { ...PUBLIC_PROVIDER_PROFILE_SELECT, user: { select: { name: true } } } },
        customer: { select: { name: true } },
        offering: true,
        quotes: { orderBy: { version: "desc" }, include: { milestones: { orderBy: { sortOrder: "asc" } } } },
        recurringAgreements: { orderBy: { version: "desc" }, include: { occurrences: { orderBy: { scheduledAt: "desc" } } } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!request) throw new TRPCError({ code: "NOT_FOUND" });

    const isCustomer = request.customerId === ctx.userId;
    const isOwningProvider = request.providerProfile.userId === ctx.userId;
    if (!isCustomer && !isOwningProvider) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this request." });
    }
    return request;
  }),

  // Provider's incoming request queue, across all their offerings.
  forProvider: homeServicesVerifiedProviderProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const items = await ctx.db.serviceRequest.findMany({
        where: { providerProfileId: (ctx as any).providerProfileId },
        include: {
          customer: { select: { name: true } },
          offering: true,
          quotes: { orderBy: { version: "desc" }, include: { milestones: { orderBy: { sortOrder: "asc" } } } },
          recurringAgreements: { orderBy: { version: "desc" }, include: { occurrences: { orderBy: { scheduledAt: "desc" } } } },
          messages: { orderBy: { createdAt: "asc" } },
        },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: "desc" },
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

  // Provider accepts or declines. Accepting requires an agreed price up
  // front (even for a QUOTE offering — this IS the quote), since
  // commission at completion is computed from agreedPriceNaira.
  respond: homeServicesVerifiedProviderProcedure
    .input(
      z.object({
        serviceRequestId: z.string(),
        status: z.enum(["ACCEPTED", "DECLINED"]),
        agreedPriceNaira: z.number().positive().optional(),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request || request.providerProfileId !== (ctx as any).providerProfileId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (request.status !== "REQUESTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Request is already ${request.status.toLowerCase()}.` });
      }
      if (input.status === "ACCEPTED" && request.transactionType !== "ONE_TIME") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Project and recurring requests require a formal proposal. Use the quote/agreement workflow." });
      }
      if (input.status === "ACCEPTED" && !input.agreedPriceNaira) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "An agreed price is required to accept a request." });
      }
      if (input.status === "ACCEPTED" && request.preferredAt && !input.scheduledAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirm the appointment time before accepting this request." });
      }
      if (input.scheduledAt && new Date(input.scheduledAt).getTime() < Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a future appointment time." });
      }

      // MVP review — these three provider-action endpoints (respond,
      // markInProgress, complete) were already ownership- and status-
      // gated, but otherwise unbounded. Lower severity than open
      // messaging (a provider can only act on their own requests, and
      // each is a one-shot transition), but flagged and closed alongside
      // the reply endpoints rather than left open indefinitely.
      await rateLimit({ scope: "service-request-respond", identifier: (ctx as any).providerProfileId, limit: 100, windowSeconds: 86_400 });

      const updated = await ctx.db.serviceRequest.update({
        where: { id: input.serviceRequestId },
        data: {
          status: input.status,
          agreedPriceNaira: input.status === "ACCEPTED" ? BigInt(Math.round(input.agreedPriceNaira!)) : undefined,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        },
      });

      await notify(ctx.db, {
        userId: request.customerId,
        type: input.status === "ACCEPTED" ? "BOOKING_ACCEPTED" : "BOOKING_DECLINED",
        title: input.status === "ACCEPTED" ? "Request accepted" : "Request declined",
        body:
          input.status === "ACCEPTED"
            ? `Your request was accepted at \u20a6${input.agreedPriceNaira!.toLocaleString()}.`
            : "The provider isn't able to take this job.",
        data: { serviceRequestId: request.id },
      });

      return updated;
    }),

  markInProgress: homeServicesVerifiedProviderProcedure
    .input(z.object({ serviceRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request || request.providerProfileId !== (ctx as any).providerProfileId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (request.status !== "ACCEPTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only an accepted request can be marked in progress." });
      }
      if (request.transactionType === "RECURRING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Recurring work is progressed per scheduled visit." });
      }
      await rateLimit({ scope: "service-request-mark-in-progress", identifier: (ctx as any).providerProfileId, limit: 100, windowSeconds: 86_400 });
      return ctx.db.serviceRequest.update({ where: { id: input.serviceRequestId }, data: { status: "IN_PROGRESS" } });
    }),

  // The billable event for Phase 2 — mirrors inquiries.create's lead-fee
  // deduction in spirit, but structurally different: commission is charged
  // POSTPAID here (added to commissionOwedNaira) rather than deducted from
  // a prepaid balance, because the amount isn't known until this moment
  // (see ProviderProfile.commissionOwedNaira's schema comment for why).
  // finalPriceNaira lets the provider adjust the price at completion
  // (e.g. the job scope changed) — falls back to the accepted price if
  // omitted, but is never allowed to be missing entirely.
  complete: homeServicesVerifiedProviderProcedure
    .input(z.object({ serviceRequestId: z.string(), finalPriceNaira: z.number().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const providerProfileId = (ctx as any).providerProfileId as string;
      const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request || request.providerProfileId !== providerProfileId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (request.status !== "ACCEPTED" && request.status !== "IN_PROGRESS") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only an accepted or in-progress request can be completed." });
      }
      if (request.transactionType === "RECURRING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Recurring agreements are completed per scheduled visit, not as a single job." });
      }
      if (request.transactionType === "INSTALLATION_PROJECT") {
        const quote = await ctx.db.serviceQuote.findFirst({ where: { requestId: request.id, status: "ACCEPTED" }, include: { milestones: true } });
        if (!quote || quote.milestones.length === 0 || quote.milestones.some((milestone) => milestone.status !== "APPROVED")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Every project milestone must be completed and approved by the customer before the project can close." });
        }
      }
      if (request.commissionBilled) {
        // Defensive — shouldn't be reachable given the status check above,
        // but guards against a retried/duplicate request double-billing.
        throw new TRPCError({ code: "BAD_REQUEST", message: "This job was already completed and billed." });
      }
      await rateLimit({ scope: "service-request-complete", identifier: providerProfileId, limit: 100, windowSeconds: 86_400 });

      const finalPrice = input.finalPriceNaira ? BigInt(Math.round(input.finalPriceNaira)) : request.agreedPriceNaira;
      if (!finalPrice) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No price on file for this job — provide finalPriceNaira." });
      }
      const config = await getPlatformConfig(ctx.db);
      const commission = calculateCommissionNaira(finalPrice, config.commissionRateBps);
      const reference = `ultra_commission_${request.id}`;

      // Concurrency fix (Execution Plan, Sprint 1): the pre-checks above run
      // outside the transaction, so two concurrent complete() calls for the
      // same request could both pass them before either commits — a classic
      // check-then-act race. The actual guard is this updateMany's WHERE
      // clause: it only affects a row that is STILL in an unbilled,
      // completable state at the moment of the write itself, atomically.
      // If a second concurrent call loses the race, `count` comes back 0
      // and it fails loudly here instead of double-billing. The unique
      // constraint on PaymentTransaction.providerRef (keyed to request.id)
      // is a second, independent layer of the same protection — even if
      // this check were ever removed, a duplicate insert would still fail
      // the unique constraint and roll back the whole transaction.
      const updated = await ctx.db.$transaction(async (tx) => {
        const { count } = await tx.serviceRequest.updateMany({
          where: {
            id: request.id,
            providerProfileId,
            commissionBilled: false,
            status: { in: ["ACCEPTED", "IN_PROGRESS"] },
          },
          data: {
            status: "COMPLETED",
            agreedPriceNaira: finalPrice,
            commissionNaira: commission,
            commissionBilled: true,
          },
        });

        if (count === 0) {
          throw new TRPCError({ code: "CONFLICT", message: "This job was already completed and billed, or is no longer in a completable state." });
        }

        await tx.providerProfile.update({
          where: { id: providerProfileId },
          data: { commissionOwedNaira: { increment: commission } },
        });

        // Accrual record, distinct from the eventual COMMISSION_SETTLEMENT
        // payment that pays it down (see payments.settleCommission) — same
        // "SUCCESS here means charged, not collected" convention
        // inquiries.ts documents for LEAD_FEE against internal_balance.
        await tx.paymentTransaction.create({
          data: {
            providerProfileId,
            type: "COMMISSION",
            status: "SUCCESS",
            amountNaira: commission,
            provider: "internal_ledger",
            providerRef: reference,
            serviceRequestId: request.id,
          },
        });

        return tx.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
      });

      await notify(ctx.db, {
        userId: request.customerId,
        type: "BOOKING_COMPLETED",
        title: "Job marked complete",
        body: `Your ${request.category.toLowerCase()} job was marked complete at \u20a6${finalPrice.toLocaleString()}.`,
        data: { serviceRequestId: request.id },
      });

      // Optimization Sprint A. providerProfileId (not ctx.userId) is the
      // relevant identity here for a completion event, since this is
      // fundamentally about the provider's activity, not the customer's —
      // deliberately different from the other five events, which all key
      // on the acting user.
      trackEvent(ctx.db, {
        type: "job_completed",
        userId: ctx.userId,
        properties: { providerProfileId, category: request.category, commissionNaira: commission.toString() },
      }).catch(() => {});

      return updated;
    }),

  // Formal installation-project quote. Milestone amounts must reconcile
  // exactly to the quoted total; the customer accepts or declines the quote
  // before work can begin.
  proposeQuote: homeServicesVerifiedProviderProcedure
    .input(z.object({
      serviceRequestId: z.string(),
      scopeSummary: z.string().trim().min(20).max(3000),
      totalPriceNaira: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      estimatedDurationDays: z.number().int().min(1).max(3650),
      validUntil: z.string().datetime().optional(),
      milestones: z.array(z.object({ title: z.string().trim().min(3).max(120), description: z.string().trim().max(500).optional(), amountNaira: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) })).min(1).max(20),
    }).superRefine((input, ctx) => {
      const sum = input.milestones.reduce((total, milestone) => total + BigInt(milestone.amountNaira), 0n);
      if (sum !== BigInt(input.totalPriceNaira)) ctx.addIssue({ code: "custom", path: ["milestones"], message: "Milestone amounts must add up exactly to the project quote." });
      if (input.validUntil && new Date(input.validUntil).getTime() <= Date.now()) ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Quote validity must be in the future." });
    }))
    .mutation(async ({ ctx, input }) => {
      const providerProfileId = (ctx as any).providerProfileId as string;
      const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request || request.providerProfileId !== providerProfileId) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.transactionType !== "INSTALLATION_PROJECT" || request.status !== "REQUESTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only an open installation-project request can receive a project quote." });
      }
      await rateLimit({ scope: "service-project-quote", identifier: providerProfileId, limit: 50, windowSeconds: 86_400 });
      const quote = await ctx.db.$transaction(async (tx) => {
        const version = await tx.serviceQuote.count({ where: { requestId: request.id } }) + 1;
        const created = await tx.serviceQuote.create({
          data: {
            requestId: request.id, providerProfileId, version, scopeSummary: input.scopeSummary,
            totalPriceNaira: BigInt(input.totalPriceNaira), estimatedDurationDays: input.estimatedDurationDays,
            validUntil: input.validUntil ? new Date(input.validUntil) : null,
            milestones: { create: input.milestones.map((milestone, index) => ({ title: milestone.title, description: milestone.description, amountNaira: BigInt(milestone.amountNaira), sortOrder: index })) },
          },
          include: { milestones: { orderBy: { sortOrder: "asc" } } },
        });
        await tx.serviceRequest.update({ where: { id: request.id }, data: { status: "PROPOSAL_PENDING" } });
        return created;
      });
      await notify(ctx.db, { userId: request.customerId, type: "SERVICE_PROPOSAL_READY", title: "Project quote ready", body: `A project quote for ₦${input.totalPriceNaira.toLocaleString()} is ready for your review.`, data: { serviceRequestId: request.id, quoteId: quote.id } });
      return quote;
    }),

  // Provider proposes the recurring service terms. The agreement is not
  // active until the customer explicitly accepts it.
  proposeAgreement: homeServicesVerifiedProviderProcedure
    .input(z.object({
      serviceRequestId: z.string(),
      serviceScope: z.string().trim().min(20).max(2000),
      frequency: z.enum(FREQUENCIES),
      pricePerVisitNaira: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      startAt: z.string().datetime(),
      endAt: z.string().datetime().optional(),
    }).superRefine((input, ctx) => {
      if (input.endAt && new Date(input.endAt).getTime() < new Date(input.startAt).getTime()) ctx.addIssue({ code: "custom", path: ["endAt"], message: "The agreement end date must be after its start date." });
    }))
    .mutation(async ({ ctx, input }) => {
      const providerProfileId = (ctx as any).providerProfileId as string;
      const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request || request.providerProfileId !== providerProfileId) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.transactionType !== "RECURRING" || request.status !== "REQUESTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only an open recurring-service request can receive an agreement proposal." });
      }
      if (new Date(input.startAt).getTime() < Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "The agreement must start in the future." });
      if (request.requestedFrequency && request.requestedFrequency !== input.frequency) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The proposed frequency must match the customer's requested frequency. Discuss a change in messages first." });
      }
      await rateLimit({ scope: "service-recurring-proposal", identifier: providerProfileId, limit: 50, windowSeconds: 86_400 });
      const agreement = await ctx.db.$transaction(async (tx) => {
        const version = await tx.recurringAgreement.count({ where: { requestId: request.id } }) + 1;
        const created = await tx.recurringAgreement.create({
          data: {
            requestId: request.id, providerProfileId, customerId: request.customerId, version,
            frequency: input.frequency, serviceScope: input.serviceScope,
            pricePerVisitNaira: BigInt(input.pricePerVisitNaira), startAt: new Date(input.startAt),
            endAt: input.endAt ? new Date(input.endAt) : null, nextServiceAt: new Date(input.startAt),
          },
        });
        await tx.serviceRequest.update({ where: { id: request.id }, data: { status: "PROPOSAL_PENDING" } });
        return created;
      });
      await notify(ctx.db, { userId: request.customerId, type: "SERVICE_PROPOSAL_READY", title: "Recurring service terms ready", body: `A ${input.frequency.toLowerCase()} service agreement is ready for your review.`, data: { serviceRequestId: request.id, agreementId: agreement.id } });
      return agreement;
    }),

  acceptProposal: homeServicesProtectedProcedure.input(z.object({ serviceRequestId: z.string() })).mutation(async ({ ctx, input }) => {
    const request = await ctx.db.serviceRequest.findUnique({
      where: { id: input.serviceRequestId },
      include: {
        quotes: { where: { status: "PROPOSED" }, orderBy: { version: "desc" }, take: 1 },
        recurringAgreements: { where: { status: "PROPOSED" }, orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!request || request.customerId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
    if (request.status !== "PROPOSAL_PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "There is no proposal awaiting your decision." });
    await rateLimit({ scope: "service-proposal-accept", identifier: ctx.userId!, limit: 50, windowSeconds: 86_400 });

    let agreedPrice: bigint;
    await ctx.db.$transaction(async (tx) => {
      if (request.transactionType === "INSTALLATION_PROJECT") {
        const quote = request.quotes[0];
        if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "The project quote is no longer available." });
        if (quote.validUntil && quote.validUntil.getTime() < Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "This quote has expired. Ask the provider to send a revised quote." });
        agreedPrice = quote.totalPriceNaira;
        const changed = await tx.serviceQuote.updateMany({ where: { id: quote.id, status: "PROPOSED" }, data: { status: "ACCEPTED" } });
        if (!changed.count) throw new TRPCError({ code: "CONFLICT", message: "The quote has changed. Refresh and try again." });
      } else if (request.transactionType === "RECURRING") {
        const agreement = request.recurringAgreements[0];
        if (!agreement) throw new TRPCError({ code: "NOT_FOUND", message: "The recurring agreement is no longer available." });
        agreedPrice = agreement.pricePerVisitNaira;
        const changed = await tx.recurringAgreement.updateMany({ where: { id: agreement.id, status: "PROPOSED" }, data: { status: "ACTIVE" } });
        if (!changed.count) throw new TRPCError({ code: "CONFLICT", message: "The agreement has changed. Refresh and try again." });
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "One-time requests do not use proposals." });
      }
      const changed = await tx.serviceRequest.updateMany({ where: { id: request.id, customerId: ctx.userId!, status: "PROPOSAL_PENDING" }, data: { status: "ACCEPTED", agreedPriceNaira: agreedPrice } });
      if (!changed.count) throw new TRPCError({ code: "CONFLICT", message: "This request has changed. Refresh and try again." });
    });
    await notify(ctx.db, { userId: (await ctx.db.providerProfile.findUniqueOrThrow({ where: { id: request.providerProfileId }, select: { userId: true } })).userId, type: "SERVICE_PROPOSAL_ACCEPTED", title: "Customer accepted your proposal", body: "The customer accepted your service terms. You can proceed with the job or schedule the first visit.", data: { serviceRequestId: request.id } });
    return ctx.db.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
  }),

  declineProposal: homeServicesProtectedProcedure.input(z.object({ serviceRequestId: z.string(), reason: z.string().trim().max(300).optional() })).mutation(async ({ ctx, input }) => {
    const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
    if (!request || request.customerId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
    if (request.status !== "PROPOSAL_PENDING") throw new TRPCError({ code: "BAD_REQUEST", message: "There is no proposal awaiting your decision." });
    await rateLimit({ scope: "service-proposal-decline", identifier: ctx.userId!, limit: 50, windowSeconds: 86_400 });
    await ctx.db.$transaction(async (tx) => {
      if (request.transactionType === "INSTALLATION_PROJECT") {
        await tx.serviceQuote.updateMany({ where: { requestId: request.id, status: { in: ["PROPOSED", "ACCEPTED"] } }, data: { status: "SUPERSEDED" } });
      } else if (request.transactionType === "RECURRING") {
        await tx.recurringAgreement.updateMany({ where: { requestId: request.id, status: "PROPOSED" }, data: { status: "CANCELLED" } });
      }
      await tx.serviceRequest.update({ where: { id: request.id }, data: { status: "REQUESTED" } });
    });
    await notify(ctx.db, { userId: (await ctx.db.providerProfile.findUniqueOrThrow({ where: { id: request.providerProfileId }, select: { userId: true } })).userId, type: "SERVICE_PROPOSAL_DECLINED", title: "Customer declined the proposal", body: input.reason || "The customer declined the proposed terms. You can discuss changes in messages and submit a new proposal.", data: { serviceRequestId: request.id } });
    return { success: true };
  }),

  updateMilestone: homeServicesVerifiedProviderProcedure.input(z.object({ milestoneId: z.string(), status: z.enum(["IN_PROGRESS", "COMPLETED"]) })).mutation(async ({ ctx, input }) => {
    const milestone = await ctx.db.serviceMilestone.findUnique({ where: { id: input.milestoneId }, include: { quote: { include: { request: true } } } });
    if (!milestone || milestone.quote.providerProfileId !== (ctx as any).providerProfileId || milestone.quote.status !== "ACCEPTED") throw new TRPCError({ code: "NOT_FOUND" });
    await rateLimit({ scope: "service-milestone-update", identifier: (ctx as any).providerProfileId, limit: 100, windowSeconds: 86_400 });
    const allowed = input.status === "IN_PROGRESS" ? milestone.status === "PENDING" : milestone.status === "IN_PROGRESS";
    if (!allowed) throw new TRPCError({ code: "BAD_REQUEST", message: "Milestone status cannot make that transition." });
    const updated = await ctx.db.$transaction(async (tx) => {
      const changed = await tx.serviceMilestone.updateMany({ where: { id: milestone.id, status: milestone.status }, data: { status: input.status, ...(input.status === "COMPLETED" ? { completedAt: new Date() } : {}) } });
      if (!changed.count) throw new TRPCError({ code: "CONFLICT", message: "This milestone has changed. Refresh and try again." });
      await tx.serviceRequest.updateMany({ where: { id: milestone.quote.requestId, status: "ACCEPTED" }, data: { status: "IN_PROGRESS" } });
      return tx.serviceMilestone.findUniqueOrThrow({ where: { id: milestone.id } });
    });
    await notify(ctx.db, { userId: milestone.quote.request.customerId, type: "SERVICE_MILESTONE_UPDATED", title: "Project milestone updated", body: `${milestone.title} is now ${input.status.toLowerCase()}.`, data: { serviceRequestId: milestone.quote.requestId, milestoneId: milestone.id } });
    return updated;
  }),

  approveMilestone: homeServicesProtectedProcedure.input(z.object({ milestoneId: z.string() })).mutation(async ({ ctx, input }) => {
    const milestone = await ctx.db.serviceMilestone.findUnique({ where: { id: input.milestoneId }, include: { quote: { include: { request: true } } } });
    if (!milestone || milestone.quote.request.customerId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
    await rateLimit({ scope: "service-milestone-approve", identifier: ctx.userId!, limit: 100, windowSeconds: 86_400 });
    if (milestone.status !== "COMPLETED") throw new TRPCError({ code: "BAD_REQUEST", message: "Only a completed milestone can be approved." });
    const changed = await ctx.db.serviceMilestone.updateMany({ where: { id: milestone.id, status: "COMPLETED" }, data: { status: "APPROVED", approvedAt: new Date() } });
    if (!changed.count) throw new TRPCError({ code: "CONFLICT", message: "This milestone has changed. Refresh and try again." });
    await notify(ctx.db, { userId: (await ctx.db.providerProfile.findUniqueOrThrow({ where: { id: milestone.quote.providerProfileId }, select: { userId: true } })).userId, type: "SERVICE_MILESTONE_UPDATED", title: "Milestone approved", body: `The customer approved: ${milestone.title}.`, data: { serviceRequestId: milestone.quote.requestId, milestoneId: milestone.id } });
    return ctx.db.serviceMilestone.findUniqueOrThrow({ where: { id: milestone.id } });
  }),

  // Recurring agreement visit scheduling and completion. Commission accrues
  // per completed visit, not against the whole agreement value.
  scheduleOccurrence: homeServicesVerifiedProviderProcedure.input(z.object({ agreementId: z.string(), scheduledAt: z.string().datetime() })).mutation(async ({ ctx, input }) => {
    const providerProfileId = (ctx as any).providerProfileId as string;
    const agreement = await ctx.db.recurringAgreement.findUnique({ where: { id: input.agreementId }, include: { request: true } });
    if (!agreement || agreement.providerProfileId !== providerProfileId) throw new TRPCError({ code: "NOT_FOUND" });
    if (agreement.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Only an active recurring agreement can be scheduled." });
    await rateLimit({ scope: "service-occurrence-schedule", identifier: providerProfileId, limit: 100, windowSeconds: 86_400 });
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt.getTime() < agreement.nextServiceAt.getTime() || scheduledAt.getTime() < Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a date on or after the next scheduled service date." });
    if (agreement.endAt && scheduledAt.getTime() > agreement.endAt.getTime()) throw new TRPCError({ code: "BAD_REQUEST", message: "The requested visit is after the agreement end date." });
    const occurrence = await ctx.db.$transaction(async (tx) => {
      const currentAgreement = await tx.recurringAgreement.findUnique({ where: { id: agreement.id } });
      if (!currentAgreement || currentAgreement.status !== "ACTIVE") throw new TRPCError({ code: "CONFLICT", message: "The recurring agreement is no longer active." });
      if (scheduledAt.getTime() < currentAgreement.nextServiceAt.getTime() || (currentAgreement.endAt && scheduledAt.getTime() > currentAgreement.endAt.getTime())) throw new TRPCError({ code: "CONFLICT", message: "The agreement schedule changed. Refresh and choose a date within the current service window." });
      const outstanding = await tx.serviceOccurrence.findFirst({ where: { agreementId: agreement.id, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } });
      if (outstanding) throw new TRPCError({ code: "CONFLICT", message: "Complete or cancel the current visit before scheduling another." });
      return tx.serviceOccurrence.create({ data: { agreementId: agreement.id, scheduledAt } });
    }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "P2034") throw new TRPCError({ code: "CONFLICT", message: "Another visit was scheduled at the same time. Refresh the agreement and try again." });
      throw error;
    });
    await notify(ctx.db, { userId: agreement.customerId, type: "SERVICE_VISIT_SCHEDULED", title: "Recurring service scheduled", body: `Your next service visit is scheduled for ${scheduledAt.toLocaleDateString("en-NG")}.`, data: { serviceRequestId: agreement.requestId, occurrenceId: occurrence.id } });
    return occurrence;
  }),

  startOccurrence: homeServicesVerifiedProviderProcedure.input(z.object({ occurrenceId: z.string() })).mutation(async ({ ctx, input }) => {
    const occurrence = await ctx.db.serviceOccurrence.findUnique({ where: { id: input.occurrenceId }, include: { agreement: true } });
    if (!occurrence || occurrence.agreement.providerProfileId !== (ctx as any).providerProfileId) throw new TRPCError({ code: "NOT_FOUND" });
    if (occurrence.status !== "SCHEDULED" || occurrence.agreement.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "This visit is not ready to start." });
    await rateLimit({ scope: "service-occurrence-start", identifier: (ctx as any).providerProfileId, limit: 100, windowSeconds: 86_400 });
    const changed = await ctx.db.serviceOccurrence.updateMany({ where: { id: occurrence.id, status: "SCHEDULED" }, data: { status: "IN_PROGRESS" } });
    if (!changed.count) throw new TRPCError({ code: "CONFLICT", message: "This visit has changed. Refresh and try again." });
    return ctx.db.serviceOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } });
  }),

  completeOccurrence: homeServicesVerifiedProviderProcedure.input(z.object({ occurrenceId: z.string(), finalPriceNaira: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional() })).mutation(async ({ ctx, input }) => {
    const providerProfileId = (ctx as any).providerProfileId as string;
    const occurrence = await ctx.db.serviceOccurrence.findUnique({ where: { id: input.occurrenceId }, include: { agreement: true } });
    if (!occurrence || occurrence.agreement.providerProfileId !== providerProfileId) throw new TRPCError({ code: "NOT_FOUND" });
    if (occurrence.status !== "IN_PROGRESS" || occurrence.commissionBilled) throw new TRPCError({ code: "BAD_REQUEST", message: "Only an unbilled in-progress visit can be completed." });
    await rateLimit({ scope: "service-occurrence-complete", identifier: providerProfileId, limit: 100, windowSeconds: 86_400 });
    const finalPrice = input.finalPriceNaira ? BigInt(input.finalPriceNaira) : occurrence.agreement.pricePerVisitNaira;
    const config = await getPlatformConfig(ctx.db);
    const commission = calculateCommissionNaira(finalPrice, config.commissionRateBps);
    const reference = `ultra_occurrence_${occurrence.id}`;
    const result = await ctx.db.$transaction(async (tx) => {
      const changed = await tx.serviceOccurrence.updateMany({ where: { id: occurrence.id, status: "IN_PROGRESS", commissionBilled: false }, data: { status: "COMPLETED", finalPriceNaira: finalPrice, commissionNaira: commission, commissionBilled: true, completedAt: new Date() } });
      if (!changed.count) throw new TRPCError({ code: "CONFLICT", message: "This visit was already completed or billed." });
      await tx.providerProfile.update({ where: { id: providerProfileId }, data: { commissionOwedNaira: { increment: commission } } });
      await tx.paymentTransaction.create({ data: { providerProfileId, type: "COMMISSION", status: "SUCCESS", amountNaira: commission, provider: "internal_ledger", providerRef: reference, serviceOccurrenceId: occurrence.id } });
      const next = nextServiceDate(occurrence.scheduledAt, occurrence.agreement.frequency);
      const expired = !!occurrence.agreement.endAt && next.getTime() > occurrence.agreement.endAt.getTime();
      await tx.recurringAgreement.update({ where: { id: occurrence.agreementId }, data: { nextServiceAt: next, status: expired ? "COMPLETED" : "ACTIVE" } });
      return tx.serviceOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } });
    });
    await notify(ctx.db, { userId: occurrence.agreement.customerId, type: "SERVICE_VISIT_COMPLETED", title: "Recurring service visit completed", body: `Your service visit was completed at ₦${Number(finalPrice).toLocaleString()}.`, data: { serviceRequestId: occurrence.agreement.requestId, occurrenceId: occurrence.id } });
    return result;
  }),

  cancelAgreement: homeServicesProtectedProcedure.input(z.object({ agreementId: z.string() })).mutation(async ({ ctx, input }) => {
    const agreement = await ctx.db.recurringAgreement.findUnique({ where: { id: input.agreementId }, include: { request: true, providerProfile: { select: { userId: true } } } });
    if (!agreement) throw new TRPCError({ code: "NOT_FOUND" });
    const isCustomer = agreement.customerId === ctx.userId;
    const isProvider = agreement.providerProfile.userId === ctx.userId;
    if (!isCustomer && !isProvider) throw new TRPCError({ code: "FORBIDDEN" });
    await rateLimit({ scope: "service-agreement-cancel", identifier: ctx.userId!, limit: 30, windowSeconds: 86_400 });
    if (agreement.status !== "ACTIVE" && agreement.status !== "PROPOSED") throw new TRPCError({ code: "BAD_REQUEST", message: "This agreement is already closed." });
    await ctx.db.$transaction(async (tx) => {
      await tx.recurringAgreement.update({ where: { id: agreement.id }, data: { status: "CANCELLED" } });
      await tx.serviceOccurrence.updateMany({ where: { agreementId: agreement.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
      await tx.serviceRequest.updateMany({ where: { id: agreement.requestId, status: { in: ["ACCEPTED", "PROPOSAL_PENDING"] } }, data: { status: "CANCELLED" } });
    });
    await notify(ctx.db, { userId: isCustomer ? agreement.providerProfile.userId : agreement.customerId, type: "BOOKING_DECLINED", title: "Recurring agreement cancelled", body: "The recurring service agreement has been cancelled.", data: { serviceRequestId: agreement.requestId, agreementId: agreement.id } });
    return { success: true };
  }),

  // Customer-initiated — only before work is in progress. A cancellation
  // also closes any proposal/recurring agreement and cancels future visits.
  cancel: homeServicesProtectedProcedure.input(z.object({ serviceRequestId: z.string() })).mutation(async ({ ctx, input }) => {
    // Sprint 4 fix (rate-limiting sweep) — a customer-initiated write with
    // no limit, same category as the provider-side mutations that already
    // had one (respond/markInProgress/complete).
    await rateLimit({ scope: "service-request-cancel", identifier: ctx.userId!, limit: 50, windowSeconds: 86_400 });
    const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
    if (!request || request.customerId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
    if (request.status !== "REQUESTED" && request.status !== "PROPOSAL_PENDING" && request.status !== "ACCEPTED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Can't cancel a job that's already ${request.status.toLowerCase()}.` });
    }
    return ctx.db.$transaction(async (tx) => {
      const agreements = await tx.recurringAgreement.findMany({ where: { requestId: request.id, status: { in: ["PROPOSED", "ACTIVE"] } }, select: { id: true } });
      if (agreements.length) {
        await tx.recurringAgreement.updateMany({ where: { id: { in: agreements.map((agreement) => agreement.id) } }, data: { status: "CANCELLED" } });
        await tx.serviceOccurrence.updateMany({ where: { agreementId: { in: agreements.map((agreement) => agreement.id) }, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
      }
      await tx.serviceQuote.updateMany({ where: { requestId: request.id, status: { in: ["PROPOSED", "ACCEPTED"] } }, data: { status: "SUPERSEDED" } });
      return tx.serviceRequest.update({ where: { id: input.serviceRequestId }, data: { status: "CANCELLED" } });
    });
  }),

  unreadMessagesCount: homeServicesProtectedProcedure.query(async ({ ctx }) => {
    const [customerMessages, providerMessages] = await Promise.all([
      ctx.db.serviceMessage.count({ where: { readAt: null, senderId: { not: ctx.userId }, serviceRequest: { customerId: ctx.userId! } } }),
      ctx.db.serviceMessage.count({ where: { readAt: null, senderId: { not: ctx.userId }, serviceRequest: { providerProfile: { userId: ctx.userId! } } } }),
    ]);
    return customerMessages + providerMessages;
  }),

  markMessagesRead: homeServicesProtectedProcedure.input(z.object({ serviceRequestId: z.string() })).mutation(async ({ ctx, input }) => {
    const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId }, include: { providerProfile: { select: { userId: true } } } });
    if (!request) throw new TRPCError({ code: "NOT_FOUND" });
    if (request.customerId !== ctx.userId && request.providerProfile.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
    return ctx.db.serviceMessage.updateMany({ where: { serviceRequestId: request.id, senderId: { not: ctx.userId }, readAt: null }, data: { readAt: new Date() } });
  }),

  reply: homeServicesProtectedProcedure
    .input(z.object({ serviceRequestId: z.string(), message: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.serviceRequest.findUnique({
        where: { id: input.serviceRequestId },
        include: { providerProfile: { select: { userId: true } } },
      });
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });

      const isCustomer = request.customerId === ctx.userId;
      const isOwningProvider = request.providerProfile.userId === ctx.userId;
      if (!isCustomer && !isOwningProvider) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this request." });
      }

      // MVP review finding — same gap and same fix as inquiries.reply.
      await rateLimit({ scope: "service-request-reply", identifier: ctx.userId!, limit: 100, windowSeconds: 3_600 });

      const msg = await ctx.db.serviceMessage.create({
        data: { serviceRequestId: input.serviceRequestId, senderId: ctx.userId!, body: input.message },
      });

      const recipientUserId = isCustomer ? request.providerProfile.userId : request.customerId;
      await notify(ctx.db, {
        userId: recipientUserId,
        type: "NEW_MESSAGE",
        title: "New message",
        body: input.message.slice(0, 120),
        data: { serviceRequestId: request.id },
      });

      return msg;
    }),

  // Admin oversight for the supervised Home Services pilot. Returns operational
  // request context only; private provider KYC fields and commission balances
  // are intentionally excluded.
  adminList: adminProcedure
    .input(z.object({
      status: z.enum(["REQUESTED", "PROPOSAL_PENDING", "ACCEPTED", "DECLINED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
      cursor: z.string().nullish(),
      limit: z.number().min(1).max(50).default(25),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.serviceRequest.findMany({
        where: input.status ? { status: input.status } : undefined,
        select: {
          id: true,
          status: true,
          category: true,
          transactionType: true,
          unitCount: true,
          siteName: true,
          siteAddress: true,
          preferredAt: true,
          requestedFrequency: true,
          note: true,
          scheduledAt: true,
          agreedPriceNaira: true,
          commissionNaira: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { id: true, name: true, phone: true } },
          providerProfile: {
            select: {
              id: true,
              businessName: true,
              serviceArea: true,
              verificationStatus: true,
              user: { select: { id: true, name: true, phone: true } },
            },
          },
          offering: { select: { id: true, title: true, priceType: true, priceNaira: true } },
        },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: "desc" },
      });
      let nextCursor: string | undefined;
      if (items.length > input.limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

});
