import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, verifiedRealtorProcedure, verifiedProviderProcedure, adminProcedure, publicProcedure } from "../trpc";
import { initializeTransaction } from "../lib/paystack";
import { randomUUID } from "node:crypto";
import { getPlatformConfig } from "@ultra/db";
import { PUBLIC_REALTOR_PROFILE_SELECT } from "../lib/safeProjections";
import { rateLimit } from "../lib/rateLimit";

export const paymentsRouter = router({
  // Priority-checklist fix, follow-on from the low-balance UI nudge work:
  // realtors/providers previously had no way to see the CURRENT lead fee
  // or commission rate anywhere — payments.platformConfig is admin-only,
  // and the billing page only labels past transactions after the fact.
  // Deliberately public (not even protectedProcedure): pricing
  // transparency is one of the Blueprint's own named trust values
  // ("Pricing, fees, and verification status are visible upfront — never
  // discovered after the fact"), and neither figure is sensitive the way
  // an individual balance or KYC field is.
  currentPricing: publicProcedure.query(async ({ ctx }) => {
    const config = await getPlatformConfig(ctx.db);
    return {
      leadFeeNaira: config.leadFeeNaira,
      commissionRateBps: config.commissionRateBps,
      realtorSubscriptionPriceNaira: config.realtorSubscriptionPriceNaira,
      providerSubscriptionPriceNaira: config.providerSubscriptionPriceNaira,
    };
  }),

  balance: verifiedRealtorProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.realtorProfile.findUnique({
      where: { id: (ctx as any).realtorProfileId },
      select: { creditBalanceNaira: true },
    });
    return { creditBalanceNaira: profile?.creditBalanceNaira ?? 0n };
  }),

  myTransactions: verifiedRealtorProcedure.query(async ({ ctx }) => {
    return ctx.db.paymentTransaction.findMany({
      where: { realtorProfileId: (ctx as any).realtorProfileId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  // Realtor initiates a balance top-up. Returns a Paystack checkout URL —
  // the client redirects/opens it; the balance is credited ONLY when the
  // webhook confirms payment (see apps/web/app/api/webhooks/paystack), never
  // here. This endpoint just starts the transaction and records it PENDING.
  initiateTopUp: verifiedRealtorProcedure
    .input(z.object({ amountNaira: z.number().positive().min(500), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const realtorProfileId = (ctx as any).realtorProfileId as string;
      // Sprint 4 fix (rate-limiting sweep): this endpoint calls the real
      // Paystack API — every request here is either a real external API
      // call or a burned attempt against it. Unlike a plain DB write
      // (listing-create, offering-create), a spammed loop here could also
      // rack up Paystack-side rate limit consumption or costs, not just
      // local DB bloat. 20/day matches this codebase's existing convention
      // for actor-scoped write limits (listing-create, offering-create).
      await rateLimit({ scope: "payments-initiate-topup", identifier: realtorProfileId, limit: 20, windowSeconds: 86_400 });
      const reference = `ultra_topup_${randomUUID()}`;

      // Recorded PENDING before calling Paystack — if the Paystack call
      // itself fails, we still have a record of the attempt.
      await ctx.db.paymentTransaction.create({
        data: {
          realtorProfileId,
          type: "TOPUP",
          status: "PENDING",
          amountNaira: BigInt(Math.round(input.amountNaira)),
          providerRef: reference,
        },
      });

      try {
        const result = await initializeTransaction({ email: input.email, amountNaira: input.amountNaira, reference });
        return { authorizationUrl: result.authorizationUrl, reference: result.reference };
      } catch (err) {
        await ctx.db.paymentTransaction.update({ where: { providerRef: reference }, data: { status: "FAILED" } });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (err as Error).message });
      }
    }),

  // Admin-issued refund — the actual money movement (reversing a Paystack
  // charge back to the realtor's card) happens outside this system, via
  // Paystack's own dashboard/API; this endpoint records the decision and
  // adjusts the realtor's internal balance to match. Deliberately caps the
  // decrement at the realtor's current balance rather than letting it go
  // negative — if a realtor has already spent most of a top-up on lead
  // fees before the refund is issued, the balance can't reverse further
  // than what's actually still there. The transaction record reflects the
  // amount actually applied, not the amount requested, for accurate books.
  adminIssueRefund: adminProcedure
    .input(z.object({ realtorProfileId: z.string(), amountNaira: z.number().positive(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.realtorProfile.findUnique({ where: { id: input.realtorProfileId } });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const requested = BigInt(Math.round(input.amountNaira));
      const applied = requested > profile.creditBalanceNaira ? profile.creditBalanceNaira : requested;

      const reference = `ultra_refund_${randomUUID()}`;
      await ctx.db.$transaction([
        ctx.db.realtorProfile.update({
          where: { id: input.realtorProfileId },
          data: { creditBalanceNaira: { decrement: applied } },
        }),
        ctx.db.paymentTransaction.create({
          data: {
            realtorProfileId: input.realtorProfileId,
            type: "REFUND",
            status: "SUCCESS",
            amountNaira: applied,
            providerRef: reference,
            note:
              applied < requested
                ? `${input.note} (requested \u20a6${requested}, capped at available balance \u20a6${applied})`
                : input.note,
          },
        }),
      ]);

      return { appliedAmountNaira: applied, requestedAmountNaira: requested };
    }),

  // ── Phase 2 — provider commission settlement ──
  // Inverse direction from a realtor's TOPUP: a realtor pre-loads a
  // balance to spend down; a provider pays down a balance already owed
  // (commissionOwedNaira, accrued by serviceRequests.complete). Same
  // "PENDING here, SUCCESS only via webhook" rule either way — this
  // mutation never itself marks anything paid.
  commissionOwed: verifiedProviderProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.providerProfile.findUnique({
      where: { id: (ctx as any).providerProfileId },
      select: { commissionOwedNaira: true },
    });
    return { commissionOwedNaira: profile?.commissionOwedNaira ?? 0n };
  }),

  myProviderTransactions: verifiedProviderProcedure.query(async ({ ctx }) => {
    return ctx.db.paymentTransaction.findMany({
      where: { providerProfileId: (ctx as any).providerProfileId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  settleCommission: verifiedProviderProcedure
    .input(z.object({ amountNaira: z.number().positive().min(100), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const providerProfileId = (ctx as any).providerProfileId as string;
      // Same reasoning as initiateTopUp above — a real Paystack call, same limit.
      await rateLimit({ scope: "payments-settle-commission", identifier: providerProfileId, limit: 20, windowSeconds: 86_400 });
      const reference = `ultra_commsettle_${randomUUID()}`;

      await ctx.db.paymentTransaction.create({
        data: {
          providerProfileId,
          type: "COMMISSION_SETTLEMENT",
          status: "PENDING",
          amountNaira: BigInt(Math.round(input.amountNaira)),
          providerRef: reference,
        },
      });

      try {
        const result = await initializeTransaction({ email: input.email, amountNaira: input.amountNaira, reference });
        return { authorizationUrl: result.authorizationUrl, reference: result.reference };
      } catch (err) {
        await ctx.db.paymentTransaction.update({ where: { providerRef: reference }, data: { status: "FAILED" } });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (err as Error).message });
      }
    }),

  // Admin — mirrors adminIssueRefund above, but for the provider side of
  // the ledger. A realtor refund decreases a spendable credit balance; this
  // decreases commissionOwedNaira instead (e.g. a job's price/commission
  // was entered wrong and needs correcting) — same "capped at what's
  // actually there" pattern. Closing this alongside the realtor mutation
  // rather than letting it sit open the way the realtor one did across
  // several Phase 1 sessions before a screen ever called it.
  adminIssueProviderRefund: adminProcedure
    .input(z.object({ providerProfileId: z.string(), amountNaira: z.number().positive(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.providerProfile.findUnique({ where: { id: input.providerProfileId } });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const requested = BigInt(Math.round(input.amountNaira));
      const applied = requested > profile.commissionOwedNaira ? profile.commissionOwedNaira : requested;

      const reference = `ultra_provrefund_${randomUUID()}`;
      await ctx.db.$transaction([
        ctx.db.providerProfile.update({
          where: { id: input.providerProfileId },
          data: { commissionOwedNaira: { decrement: applied } },
        }),
        ctx.db.paymentTransaction.create({
          data: {
            providerProfileId: input.providerProfileId,
            type: "REFUND",
            status: "SUCCESS",
            amountNaira: applied,
            providerRef: reference,
            note:
              applied < requested
                ? `${input.note} (requested \u20a6${requested}, capped at outstanding balance \u20a6${applied})`
                : input.note,
          },
        }),
      ]);

      return { appliedAmountNaira: applied, requestedAmountNaira: requested };
    }),

  // Readiness §5B's MANUAL_ADJUSTMENT type — distinct from a REFUND, which
  // specifically represents money moving back to a user. This is for
  // corrections that aren't refunds (e.g. crediting a realtor for a
  // platform-side billing bug, or debiting a balance that was credited in
  // error). Direction is explicit, not inferred from sign, so a typo can't
  // silently flip a credit into a debit.
  adminManualAdjustment: adminProcedure
    .input(
      z.object({
        realtorProfileId: z.string().optional(),
        providerProfileId: z.string().optional(),
        direction: z.enum(["credit", "debit"]),
        amountNaira: z.number().positive(),
        note: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.realtorProfileId === !input.providerProfileId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provide exactly one of realtorProfileId or providerProfileId." });
      }
      const amount = BigInt(Math.round(input.amountNaira));
      const reference = `ultra_adjust_${randomUUID()}`;

      if (input.realtorProfileId) {
        const profile = await ctx.db.realtorProfile.findUnique({ where: { id: input.realtorProfileId } });
        if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
        // Credit increases spendable balance; debit decreases it, capped at
        // 0 rather than going negative — same floor every other balance
        // adjustment in this file applies.
        const delta = input.direction === "credit" ? amount : profile.creditBalanceNaira < amount ? profile.creditBalanceNaira : amount;
        await ctx.db.$transaction([
          ctx.db.realtorProfile.update({
            where: { id: input.realtorProfileId },
            data: { creditBalanceNaira: input.direction === "credit" ? { increment: delta } : { decrement: delta } },
          }),
          ctx.db.paymentTransaction.create({
            data: {
              realtorProfileId: input.realtorProfileId,
              type: "MANUAL_ADJUSTMENT",
              status: "SUCCESS",
              amountNaira: delta,
              providerRef: reference,
              note: `[${input.direction}] ${input.note}`,
            },
          }),
        ]);
        return { appliedAmountNaira: delta };
      } else {
        const profile = await ctx.db.providerProfile.findUniqueOrThrow({ where: { id: input.providerProfileId! } });
        // Credit here reduces what's owed (same direction as a refund);
        // debit increases it (e.g. correcting an undercharged commission).
        const delta = input.direction === "credit" ? (profile.commissionOwedNaira < amount ? profile.commissionOwedNaira : amount) : amount;
        await ctx.db.$transaction([
          ctx.db.providerProfile.update({
            where: { id: input.providerProfileId! },
            data: { commissionOwedNaira: input.direction === "credit" ? { decrement: delta } : { increment: delta } },
          }),
          ctx.db.paymentTransaction.create({
            data: {
              providerProfileId: input.providerProfileId!,
              type: "MANUAL_ADJUSTMENT",
              status: "SUCCESS",
              amountNaira: delta,
              providerRef: reference,
              note: `[${input.direction}] ${input.note}`,
            },
          }),
        ]);
        return { appliedAmountNaira: delta };
      }
    }),

  // Gate B #6 — the actual "configurable" part, not just "config-backed
  // in the schema." Without this, an admin could see that the fee lives
  // in a table now but would still need direct DB access to change it,
  // which isn't meaningfully different from a hardcoded constant.
  platformConfig: adminProcedure.query(async ({ ctx }) => {
    return getPlatformConfig(ctx.db);
  }),

  adminUpdatePlatformConfig: adminProcedure
    .input(
      z.object({
        leadFeeNaira: z.number().positive().optional(),
        commissionRateBps: z.number().min(0).max(10_000).optional(), // 10,000 bps = 100%, a hard ceiling worth enforcing even for an admin
        // Priority-checklist fix: these two were previously hardcoded
        // constants with no admin-editable path at all — adding them here,
        // to the same mutation and the same update pattern as the two
        // fields above, rather than a separate endpoint, since they're the
        // same category of thing ("a platform price") and an operator
        // shouldn't need to remember two different places to change prices.
        realtorSubscriptionPriceNaira: z.number().positive().optional(),
        providerSubscriptionPriceNaira: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (Object.values(input).every((v) => v === undefined)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provide at least one value to update." });
      }
      await getPlatformConfig(ctx.db); // ensures the row exists before updating it
      return ctx.db.platformConfig.update({
        where: { id: "default" },
        data: {
          ...(input.leadFeeNaira !== undefined && { leadFeeNaira: BigInt(Math.round(input.leadFeeNaira)) }),
          ...(input.commissionRateBps !== undefined && { commissionRateBps: input.commissionRateBps }),
          ...(input.realtorSubscriptionPriceNaira !== undefined && {
            realtorSubscriptionPriceNaira: BigInt(Math.round(input.realtorSubscriptionPriceNaira)),
          }),
          ...(input.providerSubscriptionPriceNaira !== undefined && {
            providerSubscriptionPriceNaira: BigInt(Math.round(input.providerSubscriptionPriceNaira)),
          }),
          updatedByAdminId: ctx.userId,
        },
      });
    }),

  // Sprint 2 addition (MVP Audit P1 — "the billing policy allows buyer
  // inquiries when the realtor has insufficient balance... expose the
  // state to admins"). The FAILED PaymentTransaction row was always
  // created correctly (see inquiries.ts), so the underlying data has been
  // accurate the whole time — there was just no way for an admin to
  // actually see it without direct DB access. Cursor-paginated to match
  // every other admin queue in this codebase's admin routers (realtors.ts,
  // listings.ts), since an unbounded list here has the same "fine at seed
  // volume, not at real volume" problem those already solved for.
  failedLeadFees: adminProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(100).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 30;
      const items = await ctx.db.paymentTransaction.findMany({
        where: { type: "LEAD_FEE", status: "FAILED" },
        // Note: PaymentTransaction.inquiryId is a plain scalar FK with no
        // `@relation` declared on the model (confirmed against the actual
        // schema — RealtorProfile/ProviderProfile are relations, inquiryId/
        // serviceRequestId deliberately aren't), so it comes back as-is on
        // every row without needing an `include`. An admin UI that wants
        // full listing context from it can resolve it via the existing
        // admin listing lookup rather than this query trying to do both.
        include: {
          realtorProfile: { select: { ...PUBLIC_REALTOR_PROFILE_SELECT, creditBalanceNaira: true } },
        },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: "desc" },
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),
});
