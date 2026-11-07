import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure, adminProcedure, verifiedProviderProcedure } from "../trpc";
import { notify } from "../lib/notify";
import { initializeTransaction } from "../lib/paystack";
import { randomUUID } from "node:crypto";
import { rateLimit } from "../lib/rateLimit";
import { generateVerificationDocReadUrl } from "../lib/storage";
import { PUBLIC_PROVIDER_PROFILE_SELECT } from "../lib/safeProjections";
import { trackEvent } from "../lib/analytics";
import { getPlatformConfig } from "@ultra/db";

const SERVICE_CATEGORIES = ["PAINTING", "PLUMBING", "FUMIGATION", "ELECTRICAL"] as const;

// PROVIDER_SUBSCRIPTION_PRICE_NAIRA removed as part of the priority-checklist
// fix centralizing subscription pricing into PlatformConfig — see
// realtors.ts's identical fix and PlatformConfig.providerSubscriptionPriceNaira
// @default(10000) in schema.prisma for the new source of truth.
const PROVIDER_SUBSCRIPTION_DURATION_DAYS = 30;

// Explicit product decision: providers can accept jobs on the FREE tier,
// commission-only, for this many days after verification before a
// subscription becomes part of how they're ranked/surfaced. Set once, at
// approval time — see adminSetVerificationStatus.
const FREE_ONBOARDING_WINDOW_DAYS = 60;

export const providersRouter = router({
  // Public — shown on a provider's public profile page in the customer app.
  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    // Same IP-scoped pattern as listings.byId — generous limit tuned for
    // normal browsing, not a barrier to it. This closes the same gap the
    // Phase 1 handoff flagged for listings.search/byId, which arrived
    // several sessions after those endpoints first shipped; no reason for
    // Phase 2 to repeat the gap and wait as long to close it.
    if (ctx.ipAddress) {
      await rateLimit({ scope: "providers-byId", identifier: ctx.ipAddress, limit: 200, windowSeconds: 60 });
    }
    const profile = await ctx.db.providerProfile.findUnique({
      where: { id: input.id },
      // Remediation (Phase 1 trust boundary repair, item 1, extended to
      // Phase 2): this returned the RAW profile with no select at all —
      // commissionOwedNaira, idDocumentUrl, cacRegistrationNo, all leaked
      // to any public caller viewing a provider's profile.
      select: {
        ...PUBLIC_PROVIDER_PROFILE_SELECT,
        user: { select: { name: true } },
        offerings: { where: { active: true } },
      },
    });
    if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
    return profile;
  }),

  // Customer-facing discovery — browse verified providers by category.
  // Deliberately mirrors listings.search's shape (cursor pagination,
  // subscription-tier boost checked live against subscriptionExpiresAt)
  // rather than inventing a different pattern for the same underlying idea.
  search: publicProcedure
    .input(
      z.object({
        category: z.enum(SERVICE_CATEGORIES).optional(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.ipAddress) {
        await rateLimit({ scope: "providers-search", identifier: ctx.ipAddress, limit: 120, windowSeconds: 60 });
      }
      const now = new Date();
      const items = await ctx.db.providerProfile.findMany({
        where: {
          verificationStatus: "VERIFIED",
          ...(input.category && { categories: { has: input.category } }),
          offerings: { some: { active: true, ...(input.category && { category: input.category }) } },
        },
        // Remediation (Phase 1 trust boundary repair, item 1): this was
        // `include`, which returns every scalar field on ProviderProfile
        // — commissionOwedNaira and idDocumentUrl included — to a public
        // search endpoint. `select` with the safe-field allowlist plus
        // the nested relations achieves the same shape the frontend
        // actually reads, minus everything it shouldn't.
        select: {
          ...PUBLIC_PROVIDER_PROFILE_SELECT,
          user: { select: { name: true } },
          offerings: { where: { active: true, ...(input.category && { category: input.category }) } },
        },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: [{ createdAt: "desc" }],
      });
      let nextCursor: string | undefined;
      if (items.length > input.limit) nextCursor = items.pop()!.id;

      // Boost active-subscription providers to the front of this page,
      // same "checked live, not trusted from the tier field alone" rule
      // realtors.ts documents for listings.search.
      const boosted = [...items].sort((a, b) => {
        const aBoost = a.subscriptionTier === "PREMIUM" && a.subscriptionExpiresAt && a.subscriptionExpiresAt > now ? 1 : 0;
        const bBoost = b.subscriptionTier === "PREMIUM" && b.subscriptionExpiresAt && b.subscriptionExpiresAt > now ? 1 : 0;
        return bBoost - aBoost;
      });

      // Optimization Sprint A — same "skip cursor pages" rule as
      // listings.search, so one real search action isn't inflated into
      // several events by its own "load more" pagination.
      if (!input.cursor) {
        trackEvent(ctx.db, {
          type: "search_performed",
          userId: ctx.userId,
          properties: { domain: "services", category: input.category, resultCount: boosted.length },
        }).catch(() => {});
      }

      return { items: boosted, nextCursor };
    }),

  // Step "Verification" — creates the ProviderProfile in PENDING_REVIEW.
  // Same non-auto-verify pattern as realtors.applyForVerification: the
  // founding team hand-reviews the first cohort directly (Blueprint §9's
  // logic, reused as-is for Phase 2 rather than re-litigated).
  applyForVerification: protectedProcedure
    .input(
      z.object({
        businessName: z.string().min(2),
        categories: z.array(z.enum(SERVICE_CATEGORIES)).min(1, "Select at least one service category"),
        cacRegistrationNo: z.string().optional(),
        // Same fix as realtors.applyForVerification (see that file's
        // comment) — this field stores an R2 object key post-KYC-remediation,
        // not a URL, and `.url()` rejected every real submission.
        idDocumentUrl: z
          .string()
          .min(1)
          .regex(/^verification-doc\//, "Must be a verification-doc upload key from uploads.presignVerificationDoc."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Remediation (Gate B #3) — same fix as realtors.applyForVerification.
      const existingProfile = await ctx.db.providerProfile.findUnique({ where: { userId: ctx.userId! } });
      const fromStatus = existingProfile?.verificationStatus ?? "UNVERIFIED";

      const profile = await ctx.db.providerProfile.upsert({
        where: { userId: ctx.userId! },
        update: { ...input, verificationStatus: "PENDING_REVIEW" },
        create: { userId: ctx.userId!, ...input, verificationStatus: "PENDING_REVIEW" },
      });
      await ctx.db.providerVerificationLog.create({
        data: { providerProfileId: profile.id, fromStatus, toStatus: "PENDING_REVIEW", note: "Application submitted" },
      });
      return profile;
    }),

  myProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.providerProfile.findUnique({ where: { userId: ctx.userId! } });
  }),

  // Step "Create profile" — only meaningful once VERIFIED. Deliberately
  // separate from applyForVerification: bio/serviceArea are presentation
  // details for the customer-facing profile, not verification inputs, and
  // shouldn't block or reopen the verification queue when edited later.
  updateProfile: verifiedProviderProcedure
    .input(z.object({ bio: z.string().max(1000).optional(), serviceArea: z.string().min(2).optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.providerProfile.update({
        where: { id: (ctx as any).providerProfileId },
        data: input,
      });
    }),

  // ── Offerings ("Add offerings" step) ──

  myOfferings: verifiedProviderProcedure.query(async ({ ctx }) => {
    return ctx.db.offering.findMany({
      where: { providerProfileId: (ctx as any).providerProfileId },
      orderBy: { createdAt: "desc" },
    });
  }),

  createOffering: verifiedProviderProcedure
    .input(
      z.object({
        category: z.enum(SERVICE_CATEGORIES),
        title: z.string().min(3).max(120),
        description: z.string().min(10).max(2000),
        priceType: z.enum(["FIXED", "HOURLY", "QUOTE"]),
        priceNaira: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const providerProfileId = (ctx as any).providerProfileId as string;

      // Same guard as listing-create — a compromised or malicious provider
      // account shouldn't be able to spam offerings with no limit.
      await rateLimit({ scope: "offering-create", identifier: providerProfileId, limit: 20, windowSeconds: 86_400 });

      const profile = await ctx.db.providerProfile.findUniqueOrThrow({ where: { id: providerProfileId } });
      if (!profile.categories.includes(input.category)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Your account isn't verified for ${input.category}. Categories are set at verification — contact support to add one.`,
        });
      }

      // FIXED/HOURLY need a price; QUOTE explicitly doesn't (and shouldn't
      // carry a stale one) — same "enforced in the router since Prisma
      // can't express an enum-conditional required field" pattern the
      // schema comment on Listing.videoUrl documents for Phase 1.
      if (input.priceType !== "QUOTE" && !input.priceNaira) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `A price is required for ${input.priceType} offerings.` });
      }

      return ctx.db.offering.create({
        data: {
          providerProfileId,
          category: input.category,
          title: input.title,
          description: input.description,
          priceType: input.priceType,
          priceNaira: input.priceType === "QUOTE" ? null : BigInt(Math.round(input.priceNaira!)),
        },
      });
    }),

  updateOffering: verifiedProviderProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(3).max(120).optional(),
        description: z.string().min(10).max(2000).optional(),
        priceType: z.enum(["FIXED", "HOURLY", "QUOTE"]).optional(),
        priceNaira: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      // Sprint 4 fix (rate-limiting sweep) — matches createOffering's limit.
      await rateLimit({ scope: "offering-update", identifier: (ctx as any).providerProfileId, limit: 50, windowSeconds: 86_400 });
      const offering = await ctx.db.offering.findUnique({ where: { id } });
      if (!offering || offering.providerProfileId !== (ctx as any).providerProfileId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const nextPriceType = updates.priceType ?? offering.priceType;

      // Remediation (Gate B #5): the create-time invariant ("FIXED/HOURLY
      // need a price, QUOTE never carries one") was enforced in
      // createOffering but not re-checked here. Previously, changing
      // priceType from QUOTE to FIXED/HOURLY without also supplying a new
      // priceNaira left the offering with priceType=FIXED and
      // priceNaira=null — a state createOffering would have rejected
      // outright. Computed once, validated against the FULL resulting
      // state (not just the fields being touched in isolation), then used
      // for the actual write.
      const nextPriceNaira =
        nextPriceType === "QUOTE" ? null : updates.priceNaira !== undefined ? BigInt(Math.round(updates.priceNaira)) : offering.priceNaira;

      if (nextPriceType !== "QUOTE" && nextPriceNaira === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A price is required for ${nextPriceType} offerings — provide priceNaira along with the new priceType.`,
        });
      }

      return ctx.db.offering.update({
        where: { id },
        data: { ...updates, priceNaira: nextPriceNaira },
      });
    }),

  // Pause/unpause — doesn't require re-verification, unlike a listing's
  // status transitions which route through admin review.
  setOfferingActive: verifiedProviderProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Sprint 4 fix (rate-limiting sweep). Same limit as listing-set-status.
      await rateLimit({ scope: "offering-set-active", identifier: (ctx as any).providerProfileId, limit: 50, windowSeconds: 86_400 });
      const offering = await ctx.db.offering.findUnique({ where: { id: input.id } });
      if (!offering || offering.providerProfileId !== (ctx as any).providerProfileId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.db.offering.update({ where: { id: input.id }, data: { active: input.active } });
    }),

  // ── Dashboard ──

  dashboardSummary: verifiedProviderProcedure.query(async ({ ctx }) => {
    const providerProfileId = (ctx as any).providerProfileId as string;
    const [profile, activeOfferings, pendingRequests, completedJobs] = await Promise.all([
      ctx.db.providerProfile.findUniqueOrThrow({ where: { id: providerProfileId } }),
      ctx.db.offering.count({ where: { providerProfileId, active: true } }),
      ctx.db.serviceRequest.count({ where: { providerProfileId, status: "REQUESTED" } }),
      ctx.db.serviceRequest.count({ where: { providerProfileId, status: "COMPLETED" } }),
    ]);
    const now = new Date();
    return {
      businessName: profile.businessName,
      verificationStatus: profile.verificationStatus,
      activeOfferings,
      pendingRequests,
      completedJobs,
      commissionOwedNaira: profile.commissionOwedNaira,
      subscriptionTier: profile.subscriptionTier,
      subscriptionActive: profile.subscriptionTier === "PREMIUM" && !!profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > now,
      inFreeOnboardingWindow: !!profile.freeUntil && profile.freeUntil > now,
      freeUntil: profile.freeUntil,
    };
  }),

  // ── Admin ──

  // Mirrors realtors.adminSearch — same "find by name/phone rather than a
  // raw ID" utility, for the provider refund screen.
  adminSearch: adminProcedure.input(z.object({ query: z.string().min(2) })).query(async ({ ctx, input }) => {
    return ctx.db.providerProfile.findMany({
      where: {
        verificationStatus: "VERIFIED",
        OR: [{ businessName: { contains: input.query, mode: "insensitive" } }, { user: { phone: { contains: input.query } } }],
      },
      include: { user: { select: { name: true, phone: true } } },
      take: 10,
    });
  }),

  // Remediation (Phase 1 trust boundary repair, item 3) — mirrors
  // realtors.adminGetVerificationDocUrl exactly.
  adminGetVerificationDocUrl: adminProcedure
    .input(z.object({ providerProfileId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.providerProfile.findUnique({ where: { id: input.providerProfileId } });
      if (!profile?.idDocumentUrl) throw new TRPCError({ code: "NOT_FOUND", message: "No document on file." });
      const url = await generateVerificationDocReadUrl(profile.idDocumentUrl);
      return { url, expiresInSeconds: 300 };
    }),

  pendingApplications: adminProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const items = await ctx.db.providerProfile.findMany({
        where: { verificationStatus: "PENDING_REVIEW" },
        include: { user: { select: { name: true, phone: true, createdAt: true } } },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: "asc" },
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

  adminSetVerificationStatus: adminProcedure
    .input(z.object({ providerProfileId: z.string(), status: z.enum(["VERIFIED", "REJECTED", "SUSPENDED"]), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.providerProfile.findUnique({ where: { id: input.providerProfileId } });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const freeUntil = new Date();
      freeUntil.setDate(freeUntil.getDate() + FREE_ONBOARDING_WINDOW_DAYS);

      const updated = await ctx.db.providerProfile.update({
        where: { id: input.providerProfileId },
        data: {
          verificationStatus: input.status,
          verifiedAt: input.status === "VERIFIED" ? new Date() : null,
          // Readiness §3A, Levels 1 & 2 — same reasoning as realtors.ts.
          ...(input.status === "VERIFIED" && { identityVerified: true, businessVerified: true }),
          // Only set on first approval — re-approving after a prior
          // SUSPENDED shouldn't hand out a second free window.
          ...(input.status === "VERIFIED" && !profile.freeUntil && { freeUntil }),
        },
      });

      // Same root-cause fix as realtors.ts's adminSetVerificationStatus:
      // only upgrades role on VERIFIED, never auto-downgrades on
      // REJECTED/SUSPENDED (a suspended provider may have legitimate
      // BUYER-side activity worth preserving).
      if (input.status === "VERIFIED") {
        await ctx.db.user.update({ where: { id: profile.userId }, data: { role: "PROVIDER" } });
      }

      await ctx.db.providerVerificationLog.create({
        data: {
          providerProfileId: profile.id,
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
              ? `Your provider account is verified — you can now add offerings and receive job requests. You're on the free tier for your first ${FREE_ONBOARDING_WINDOW_DAYS} days.`
              : input.note || "Your application needs changes before it can be approved.",
          data: { providerProfileId: profile.id },
        });
      }

      return updated;
    }),

  // ── Subscription — same additive-not-replacement pattern as realtors.ts ──

  subscriptionStatus: verifiedProviderProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.providerProfile.findUniqueOrThrow({ where: { id: (ctx as any).providerProfileId } });
    const now = new Date();
    const isActive = profile.subscriptionTier === "PREMIUM" && !!profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > now;
    return {
      tier: profile.subscriptionTier,
      expiresAt: profile.subscriptionExpiresAt,
      isActive,
      inFreeOnboardingWindow: !!profile.freeUntil && profile.freeUntil > now,
      freeUntil: profile.freeUntil,
    };
  }),

  initiateSubscription: verifiedProviderProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const providerProfileId = (ctx as any).providerProfileId as string;
      // Sprint 4 fix (rate-limiting sweep) — same reasoning as the realtor
      // equivalent and payments.initiateTopUp/settleCommission.
      await rateLimit({ scope: "providers-initiate-subscription", identifier: providerProfileId, limit: 20, windowSeconds: 86_400 });
      const reference = `ultra_provsub_${randomUUID()}`;
      const config = await getPlatformConfig(ctx.db);
      const priceNaira = Number(config.providerSubscriptionPriceNaira);

      await ctx.db.paymentTransaction.create({
        data: {
          providerProfileId,
          type: "SUBSCRIPTION",
          status: "PENDING",
          amountNaira: config.providerSubscriptionPriceNaira,
          providerRef: reference,
        },
      });

      try {
        const result = await initializeTransaction({ email: input.email, amountNaira: priceNaira, reference });
        return {
          authorizationUrl: result.authorizationUrl,
          reference: result.reference,
          priceNaira,
          durationDays: PROVIDER_SUBSCRIPTION_DURATION_DAYS,
        };
      } catch (err) {
        await ctx.db.paymentTransaction.update({ where: { providerRef: reference }, data: { status: "FAILED" } });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (err as Error).message });
      }
    }),
});
