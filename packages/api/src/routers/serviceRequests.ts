import { z } from "zod";
import { router, protectedProcedure, verifiedProviderProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { notify } from "../lib/notify";
import { rateLimit } from "../lib/rateLimit";
import { calculateCommissionNaira, getPlatformConfig } from "@ultra/db";
import { PUBLIC_PROVIDER_PROFILE_SELECT } from "../lib/safeProjections";
import { trackEvent } from "../lib/analytics";

const SERVICE_CATEGORIES = ["PAINTING", "PLUMBING", "FUMIGATION", "ELECTRICAL"] as const;

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
  create: protectedProcedure
    .input(
      z.object({
        providerProfileId: z.string(),
        offeringId: z.string().optional(),
        category: z.enum(SERVICE_CATEGORIES),
        note: z.string().trim().min(10, "Add a bit more detail so the provider knows what the job involves.").max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.providerProfile.findUnique({ where: { id: input.providerProfileId } });
      if (!provider || provider.verificationStatus !== "VERIFIED") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found or not verified." });
      }
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
  myRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.serviceRequest.findMany({
      where: { customerId: ctx.userId! },
      include: {
        // Remediation (Phase 1 trust boundary repair, item 1): same leak
        // class as inquiries.myThreads — a customer never needs the
        // provider's commissionOwedNaira or KYC document URL.
        providerProfile: { select: { ...PUBLIC_PROVIDER_PROFILE_SELECT, user: { select: { name: true } } } },
        offering: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Single-thread fetch with ownership check — mirrors inquiries.byId
  // exactly, checked against either side of a service request instead of
  // a listing.
  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const request = await ctx.db.serviceRequest.findUnique({
      where: { id: input.id },
      include: {
        providerProfile: { select: { ...PUBLIC_PROVIDER_PROFILE_SELECT, user: { select: { name: true } } } },
        customer: { select: { name: true } },
        offering: true,
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
  forProvider: verifiedProviderProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const items = await ctx.db.serviceRequest.findMany({
        where: { providerProfileId: (ctx as any).providerProfileId },
        include: {
          customer: { select: { name: true } },
          offering: true,
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
  respond: verifiedProviderProcedure
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
      if (input.status === "ACCEPTED" && !input.agreedPriceNaira) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "An agreed price is required to accept a request." });
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

  markInProgress: verifiedProviderProcedure
    .input(z.object({ serviceRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request || request.providerProfileId !== (ctx as any).providerProfileId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (request.status !== "ACCEPTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only an accepted request can be marked in progress." });
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
  complete: verifiedProviderProcedure
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

  // Customer-initiated — only while still REQUESTED or ACCEPTED (not once
  // work has started, mirroring why Phase 1 doesn't let a realtor un-close
  // a SOLD listing casually).
  cancel: protectedProcedure.input(z.object({ serviceRequestId: z.string() })).mutation(async ({ ctx, input }) => {
    // Sprint 4 fix (rate-limiting sweep) — a customer-initiated write with
    // no limit, same category as the provider-side mutations that already
    // had one (respond/markInProgress/complete).
    await rateLimit({ scope: "service-request-cancel", identifier: ctx.userId!, limit: 50, windowSeconds: 86_400 });
    const request = await ctx.db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
    if (!request || request.customerId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
    if (request.status !== "REQUESTED" && request.status !== "ACCEPTED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Can't cancel a job that's already ${request.status.toLowerCase()}.` });
    }
    return ctx.db.serviceRequest.update({ where: { id: input.serviceRequestId }, data: { status: "CANCELLED" } });
  }),

  reply: protectedProcedure
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
});
