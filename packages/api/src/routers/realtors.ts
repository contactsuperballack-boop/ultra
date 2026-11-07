import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure, adminProcedure, verifiedRealtorProcedure } from "../trpc";
import { notify } from "../lib/notify";
import { initializeTransaction } from "../lib/paystack";
import { randomUUID } from "node:crypto";
import { generateVerificationDocReadUrl } from "../lib/storage";
import { PUBLIC_REALTOR_PROFILE_SELECT } from "../lib/safeProjections";
import { rateLimit } from "../lib/rateLimit";
import { getPlatformConfig } from "@ultra/db";

// SUBSCRIPTION_PRICE_NAIRA removed as part of the priority-checklist fix
// centralizing subscription pricing into PlatformConfig (see
// getPlatformConfig() usage in initiateSubscription below) — the live
// default now lives in schema.prisma's PlatformConfig.realtorSubscriptionPriceNaira
// @default(15000), not duplicated here as a second source of truth.
const SUBSCRIPTION_DURATION_DAYS = 30;

export const realtorsRouter = router({
  // Public — shown on listing detail screens.
  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    // Sprint 4 fix (rate-limiting sweep): this public endpoint never got
    // the IP-scoped rate limit that listings.byId and providers.byId both
    // received — the same "found a third time" pattern the comment right
    // below already documents for the data-exposure version of this exact
    // gap. The fix for one issue on this endpoint didn't carry over to
    // its sibling concern; matching listings.byId's limit exactly.
    await rateLimit({ scope: "realtors-byId", identifier: ctx.ipAddress, limit: 200, windowSeconds: 60 });

    // Remediation follow-up, found while building Sprint C's realtor
    // profile screen: this was `include`, the exact same leak class fixed
    // everywhere else in the Phase 1 remediation pass — creditBalanceNaira,
    // idDocumentUrl, cacRegistrationNo, restrictedReason all reaching a
    // PUBLIC endpoint. Missed by that pass's own sweep, which is exactly
    // why MVP_REVIEW.md flagged that sweep as manual and not the final
    // word rather than treating it as exhaustive.
    const profile = await ctx.db.realtorProfile.findUnique({
      where: { id: input.id },
      select: {
        ...PUBLIC_REALTOR_PROFILE_SELECT,
        createdAt: true,
        user: { select: { name: true } },
        listings: { where: { status: "LIVE" }, include: { photos: { take: 1 } } },
      },
    });
    if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

    // Sprint C — the mockup's realtor-profile screen shows "deals closed,"
    // which isn't the same as live-listing count (a listing that sold or
    // rented is no longer LIVE, so it wouldn't appear in `listings` above
    // at all). Counted separately rather than conflated.
    const dealsClosed = await ctx.db.listing.count({
      where: { realtorProfileId: input.id, status: { in: ["SOLD", "RENTED"] } },
    });

    return { ...profile, dealsClosed };
  }),

  // Realtor onboarding — creates a profile in UNVERIFIED status.
  // Blueprint §9: the founding team hand-reviews the first cohort directly,
  // so this deliberately does NOT auto-verify; it queues for PENDING_REVIEW.
  applyForVerification: protectedProcedure
    .input(
      z.object({
        agencyName: z.string().min(2),
        cacRegistrationNo: z.string().optional(),
        // Bug fix (found during Sprint 1 re-verification of the KYC
        // remediation): storage.ts's private-bucket fix changed this
        // field's meaning from "a public URL" to "an R2 object key"
        // (see adminGetVerificationDocUrl's comment above), but this
        // validator was never updated to match — it still required
        // `.url()`, which a bare key like
        // "verification-doc/<userId>/<uuid>.pdf" fails. Since the web
        // form (dashboard/verification/page.tsx) was already correctly
        // sending the raw key from presignVerificationDoc, this meant
        // no realtor could actually submit a verification application
        // at all: the security fix silently broke the feature it was
        // protecting. The prefix check is defense in depth — rejects a
        // caller passing an arbitrary string or a key from the wrong
        // upload purpose, not just "any non-empty string."
        idDocumentUrl: z
          .string()
          .min(1)
          .regex(/^verification-doc\//, "Must be a verification-doc upload key from uploads.presignVerificationDoc."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Remediation (Gate B #3): fetched BEFORE the upsert specifically so
      // the log below can record the real prior status. A realtor
      // resubmitting after REJECTED previously had this hardcoded to
      // "UNVERIFIED" regardless of their actual prior state, which made
      // the audit trail wrong for every resubmission.
      const existingProfile = await ctx.db.realtorProfile.findUnique({ where: { userId: ctx.userId! } });
      const fromStatus = existingProfile?.verificationStatus ?? "UNVERIFIED";

      const profile = await ctx.db.realtorProfile.upsert({
        where: { userId: ctx.userId! },
        update: { ...input, verificationStatus: "PENDING_REVIEW" },
        create: { userId: ctx.userId!, ...input, verificationStatus: "PENDING_REVIEW" },
      });
      await ctx.db.verificationLog.create({
        data: { realtorProfileId: profile.id, fromStatus, toStatus: "PENDING_REVIEW", note: "Application submitted" },
      });
      return profile;
    }),

  myProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.realtorProfile.findUnique({ where: { userId: ctx.userId! } });
  }),

  // Small lookup for admin tools (currently: the refund screen) that need
  // to find a verified realtor by name/phone rather than requiring a raw
  // profile ID typed in blind. Scoped to VERIFIED accounts — refunds
  // correct real transaction history, which only exists past that point.
  adminSearch: adminProcedure.input(z.object({ query: z.string().min(2) })).query(async ({ ctx, input }) => {
    return ctx.db.realtorProfile.findMany({
      where: {
        verificationStatus: "VERIFIED",
        OR: [{ agencyName: { contains: input.query, mode: "insensitive" } }, { user: { phone: { contains: input.query } } }],
      },
      include: { user: { select: { name: true, phone: true } } },
      take: 10,
    });
  }),

  // Admin queue — every application currently awaiting a decision.
  // Remediation (Phase 1 trust boundary repair, item 3) — the actual
  // read-access half of the private-bucket requirement. idDocumentUrl now
  // stores an R2 object KEY, not a fetchable URL (see the applyForVerification
  // input — same field name, changed meaning, deliberately not renamed in
  // the schema to avoid a bigger migration for what's fundamentally a
  // storage-layer change). admin-only, short-lived, generated fresh per
  // call — no standing public link exists anywhere in this system.
  adminGetVerificationDocUrl: adminProcedure
    .input(z.object({ realtorProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.realtorProfile.findUnique({ where: { id: input.realtorProfileId } });
      if (!profile?.idDocumentUrl) throw new TRPCError({ code: "NOT_FOUND", message: "No document on file." });
      const url = await generateVerificationDocReadUrl(profile.idDocumentUrl);
      return { url, expiresInSeconds: 300 };
    }),

  pendingApplications: adminProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const items = await ctx.db.realtorProfile.findMany({
        where: { verificationStatus: "PENDING_REVIEW" },
        include: { user: { select: { name: true, phone: true, createdAt: true } } },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: "asc" }, // oldest first — first in, first reviewed
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

  // Admin-only — approve/reject a pending realtor application.
  adminSetVerificationStatus: adminProcedure
    .input(z.object({ realtorProfileId: z.string(), status: z.enum(["VERIFIED", "REJECTED", "SUSPENDED"]), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.realtorProfile.findUnique({ where: { id: input.realtorProfileId } });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.realtorProfile.update({
        where: { id: input.realtorProfileId },
        data: {
          verificationStatus: input.status,
          verifiedAt: input.status === "VERIFIED" ? new Date() : null,
          // Readiness §3A, Levels 1 & 2. Both set together here because the
          // current one-step application already required an ID document
          // AND CAC/agency info before reaching this admin decision — this
          // records what was actually checked, honestly, rather than
          // implying a staged review process that doesn't exist yet.
          ...(input.status === "VERIFIED" && { identityVerified: true, businessVerified: true }),
        },
      });

      // Root-cause fix, not a workaround: User.role was never being
      // promoted from the BUYER default anywhere in the codebase, even
      // after full realtor verification. Backend authorization was never
      // actually broken by this (verifiedRealtorProcedure correctly checks
      // RealtorProfile.verificationStatus, not role) — but it meant role
      // was silently meaningless for any realtor who signed up normally
      // rather than being seeded directly, which would have broken any
      // future feature that reasonably assumes role reflects reality.
      // Only upgrades on VERIFIED; never auto-downgrades on
      // REJECTED/SUSPENDED, since a suspended realtor may still have
      // legitimate BUYER-side activity/history worth preserving.
      if (input.status === "VERIFIED") {
        await ctx.db.user.update({ where: { id: profile.userId }, data: { role: "REALTOR" } });
      }

      await ctx.db.verificationLog.create({
        data: {
          realtorProfileId: profile.id,
          fromStatus: profile.verificationStatus,
          toStatus: input.status,
          note: input.note,
          actorAdminId: ctx.userId,
        },
      });

      if (input.status === "VERIFIED" || input.status === "REJECTED") {
        await notify(ctx.db, {
          userId: profile.userId,
          type: input.status === "VERIFIED" ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
          title: input.status === "VERIFIED" ? "You're verified!" : "Verification update",
          body:
            input.status === "VERIFIED"
              ? "Your realtor account is verified — you can now publish listings."
              : input.note || "Your application needs changes before it can be approved.",
          data: { realtorProfileId: profile.id },
        });
      }

      return updated;
    }),

  // ── Subscriptions (Decision 1) ──
  // A second, additive revenue lever alongside lead fees, not a replacement
  // — search ranking checks subscriptionExpiresAt directly (see
  // listings.ts's `search`), not this status alone, so an expired
  // subscription naturally stops boosting without a background job needing
  // to "turn it off."
  subscriptionStatus: verifiedRealtorProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.realtorProfile.findUniqueOrThrow({ where: { id: (ctx as any).realtorProfileId } });
    const isActive = profile.subscriptionTier === "PREMIUM" && !!profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > new Date();
    return { tier: profile.subscriptionTier, expiresAt: profile.subscriptionExpiresAt, isActive };
  }),

  // Same pattern as payments.initiateTopUp: creates a PENDING transaction
  // and returns a Paystack checkout URL. The subscription is only ever
  // activated by the webhook confirming payment — never here.
  initiateSubscription: verifiedRealtorProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const realtorProfileId = (ctx as any).realtorProfileId as string;
      // Sprint 4 fix (rate-limiting sweep) — same reasoning as
      // payments.initiateTopUp/settleCommission: a real Paystack call per
      // request, previously unlimited.
      await rateLimit({ scope: "realtors-initiate-subscription", identifier: realtorProfileId, limit: 20, windowSeconds: 86_400 });
      const reference = `ultra_sub_${randomUUID()}`;
      // Priority-checklist fix: reads the admin-configurable price instead
      // of the hardcoded constant, matching inquiries.ts's existing
      // leadFeeNaira pattern exactly.
      const config = await getPlatformConfig(ctx.db);
      const priceNaira = Number(config.realtorSubscriptionPriceNaira);

      await ctx.db.paymentTransaction.create({
        data: {
          realtorProfileId,
          type: "SUBSCRIPTION",
          status: "PENDING",
          amountNaira: config.realtorSubscriptionPriceNaira,
          providerRef: reference,
        },
      });

      try {
        const result = await initializeTransaction({ email: input.email, amountNaira: priceNaira, reference });
        return { authorizationUrl: result.authorizationUrl, reference: result.reference, priceNaira, durationDays: SUBSCRIPTION_DURATION_DAYS };
      } catch (err) {
        await ctx.db.paymentTransaction.update({ where: { providerRef: reference }, data: { status: "FAILED" } });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (err as Error).message });
      }
    }),
});
