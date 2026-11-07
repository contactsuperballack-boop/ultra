import { z } from "zod";
import { router, publicProcedure, protectedProcedure, verifiedRealtorProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { checkPriceBand, detectDuplicateSignals, DUPLICATE_REVIEW_THRESHOLD, isValidListingTransition, type DuplicateCandidate } from "@ultra/db";
import { rateLimit } from "../lib/rateLimit";
import { PUBLIC_REALTOR_PROFILE_SELECT } from "../lib/safeProjections";
import { trackEvent } from "../lib/analytics";

const searchInput = z.object({
  type: z.enum(["SALE", "RENT", "LAND"]).optional(),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).optional(),
  area: z.string().optional(),
  // Readiness §4A — "search input" and "price range" as first-screen
  // primitives. `query` matches loosely against title/area (no full-text
  // search infra yet — LIKE is fine at current listing volume, per the
  // same "don't overbuild ahead of real data" principle applied elsewhere
  // in this codebase).
  query: z.string().max(200).optional(),
  minBeds: z.number().int().min(0).optional(),
  minPriceNaira: z.number().optional(),
  maxPriceNaira: z.number().optional(),
  verifiedOnly: z.boolean().optional(),
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(50).default(20),
});

const roomTypeEnum = z.enum(["LIVING_ROOM", "KITCHEN", "BEDROOM", "BATHROOM", "EXTERIOR", "OTHER"]);

const createListingInput = z
  .object({
    title: z.string().min(5).max(120),
    description: z.string().min(20).max(2000),
    type: z.enum(["SALE", "RENT", "LAND"]),
    category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).optional(), // required for SALE/RENT, N/A for LAND — enforced below
    priceNaira: z.number().positive(),
    priceFrequency: z.enum(["ONE_TIME", "PER_YEAR", "PER_MONTH"]).default("ONE_TIME"),
    serviceChargeNaira: z.number().positive().optional(),
    negotiable: z.boolean().default(false),
    furnishing: z.enum(["FURNISHED", "UNFURNISHED", "PARTLY_FURNISHED", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
    landSizeUnit: z.enum(["SQM", "PLOTS", "ACRES", "HECTARES"]).optional(),
    availableFrom: z.string().datetime().optional(),
    locationPrecision: z.enum(["EXACT", "APPROXIMATE"]).default("APPROXIMATE"),
    area: z.string().min(2),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    sizeSqm: z.number().positive(),
    photos: z
      .array(z.object({ url: z.string().url(), roomType: roomTypeEnum.optional() }))
      .min(1)
      .max(10), // matches UPLOAD_LIMITS.MAX_IMAGES_PER_LISTING in lib/storage.ts
    videoUrl: z.string().url().optional(),
  })
  // Decision 2: plots get images only, never video. Enforced here (not
  // just in the upload UI) so a request built by hand can't smuggle a
  // video onto a LAND listing.
  .refine((data) => !(data.type === "LAND" && data.videoUrl), {
    message: "Video is not supported for land listings — images only.",
    path: ["videoUrl"],
  })
  // Readiness §9 — category is meaningful only for buildings, not land.
  .refine((data) => data.type === "LAND" || !!data.category, {
    message: "Category (residential or commercial) is required for sale/rent listings.",
    path: ["category"],
  });

export const listingsRouter = router({
  // Public search — powers both the web marketplace and the mobile Search tab.
  // Premium-subscribed realtors' listings rank first (Decision 1: subscription
  // tier affects visibility, not a paid-placement-only model) — expired
  // subscriptions (subscriptionExpiresAt in the past) do NOT get the boost,
  // checked here rather than trusting the tier field alone.
  search: publicProcedure.input(searchInput).query(async ({ ctx, input }) => {
    // Public, unauthenticated endpoint — scoped by IP, not userId (there
    // usually isn't one). Generous limit since normal browsing legitimately
    // fires several searches quickly (typing, adjusting filters); this is
    // meant to stop scraping, not slow down a real user.
    if (ctx.ipAddress) {
      await rateLimit({ scope: "listings-search", identifier: ctx.ipAddress, limit: 120, windowSeconds: 60 });
    }

    const priceFilter: { gte?: bigint; lte?: bigint } = {};
    if (input.minPriceNaira !== undefined) priceFilter.gte = BigInt(input.minPriceNaira);
    if (input.maxPriceNaira !== undefined) priceFilter.lte = BigInt(input.maxPriceNaira);

    const where = {
      status: "LIVE" as const,
      ...(input.type && { type: input.type }),
      ...(input.category && { category: input.category }),
      ...(input.area && { area: input.area }),
      ...(input.query && {
        OR: [
          { title: { contains: input.query, mode: "insensitive" as const } },
          { area: { contains: input.query, mode: "insensitive" as const } },
          { description: { contains: input.query, mode: "insensitive" as const } },
        ],
      }),
      ...(input.minBeds !== undefined && { bedrooms: { gte: input.minBeds } }),
      ...(Object.keys(priceFilter).length > 0 && { priceNaira: priceFilter }),
      ...(input.verifiedOnly && { realtorProfile: { verificationStatus: "VERIFIED" as const } }),
    };

    const items = await ctx.db.listing.findMany({
      where,
      take: input.limit + 1,
      ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      // Cursor pagination + a computed (non-column) sort don't mix cleanly
      // in Prisma, so the Premium boost is applied by re-sorting the page
      // in memory after fetching — correct at MVP page sizes (≤50), would
      // need a real ranking column if this ever needs to scale past a few
      // thousand concurrent LIVE listings.
      orderBy: { publishedAt: "desc" },
      include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 }, realtorProfile: { select: PUBLIC_REALTOR_PROFILE_SELECT } },
    });

    let nextCursor: string | undefined;
    if (items.length > input.limit) {
      const next = items.pop();
      nextCursor = next!.id;
    }

    const now = new Date();
    const isBoosted = (l: (typeof items)[number]) =>
      l.realtorProfile.subscriptionTier === "PREMIUM" && l.realtorProfile.subscriptionExpiresAt && l.realtorProfile.subscriptionExpiresAt > now;
    items.sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)));

    // Optimization Sprint A — cursor-page requests (input.cursor set) are
    // excluded from tracking; those are "load more" on an already-tracked
    // search, not a new search event, and would otherwise inflate the
    // count for one real search action into several.
    if (!input.cursor) {
      trackEvent(ctx.db, {
        type: "search_performed",
        userId: ctx.userId,
        properties: { domain: "listings", type: input.type, area: input.area, query: input.query, resultCount: items.length },
      }).catch(() => {});
    }

    return { items, nextCursor };
  }),

  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (ctx.ipAddress) {
      await rateLimit({ scope: "listings-byId", identifier: ctx.ipAddress, limit: 200, windowSeconds: 60 });
    }
    const listing = await ctx.db.listing.findUnique({
      where: { id: input.id },
      include: { photos: { orderBy: { sortOrder: "asc" } }, realtorProfile: { select: PUBLIC_REALTOR_PROFILE_SELECT } },
    });
    if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

    // Remediation (Phase 1 trust boundary repair, item 2): a non-LIVE
    // listing (DRAFT, PENDING_REVIEW, UNDER_REVIEW, REMOVED, SOLD/RENTED
    // — this last pair intentionally included, since Readiness §9 has no
    // "sold but still publicly browsable" concept) is only visible to the
    // realtor who owns it or an admin. Previously this endpoint returned
    // ANY listing by id regardless of status to an unauthenticated
    // caller — including ones removed for fraud or still awaiting
    // moderation. Returns NOT_FOUND rather than FORBIDDEN specifically so
    // an unauthorized caller can't distinguish "doesn't exist" from
    // "exists but you can't see it," which would otherwise let someone
    // enumerate removed/flagged listing ids.
    if (listing.status !== "LIVE") {
      let authorized = false;
      if (ctx.userId) {
        const caller = await ctx.db.user.findUnique({
          where: { id: ctx.userId },
          select: { role: true, realtorProfile: { select: { id: true } } },
        });
        authorized =
          caller?.role === "ADMIN" ||
          caller?.role === "SUPER_ADMIN" ||
          (!!caller?.realtorProfile && caller.realtorProfile.id === listing.realtorProfileId);
      }
      if (!authorized) throw new TRPCError({ code: "NOT_FOUND" });
    }

    // Fire-and-forget view increment — not awaited so it doesn't slow the read.
    ctx.db.listing.update({ where: { id: input.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    // Optimization Sprint A — same fire-and-forget spirit. trackEvent's
    // own external-provider call is already safely caught internally, but
    // the durable AnalyticsEvent write itself could still reject (e.g. a
    // DB hiccup) — .catch() here is what actually prevents an unhandled
    // promise rejection from an un-awaited call, not optional polish.
    trackEvent(ctx.db, { type: "listing_viewed", userId: ctx.userId, properties: { listingId: listing.id, area: listing.area, type: listing.type } }).catch(() => {});

    return listing;
  }),

  // Realtor-side: create + submit for verification. Requires a VERIFIED realtor account —
  // Blueprint §9: "every realtor is verified before they can publish a listing."
  create: verifiedRealtorProcedure.input(createListingInput).mutation(async ({ ctx, input }) => {
    // Audit finding: a compromised or malicious realtor account could
    // previously spam listings with no limit at all.
    await rateLimit({ scope: "listing-create", identifier: (ctx as any).realtorProfileId, limit: 20, windowSeconds: 86_400 });

    // Readiness §3D — a realtor restricted after repeated reports can't
    // publish new listings until the restriction is lifted. Checked here,
    // not just hidden in the UI — the same "server-side is the real
    // enforcement" rule this codebase already applies to admin routes.
    const realtorProfile = await ctx.db.realtorProfile.findUniqueOrThrow({
      where: { id: (ctx as any).realtorProfileId },
      include: { user: { select: { phone: true } } },
    });
    if (realtorProfile.restrictedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: realtorProfile.restrictedReason || "Your account is currently restricted from publishing new listings. Contact support.",
      });
    }

    const flagReason = checkPriceBand(input.area, input.priceNaira, input.sizeSqm);

    // Readiness §3B — deterministic duplicate detection, checked against
    // other active listings in the same area (the address-based signals
    // only fire on an area match anyway, so this keeps the query cheap and
    // uses the existing @@index([area])).
    const candidatesInArea = await ctx.db.listing.findMany({
      where: { area: input.area, status: { notIn: ["REMOVED"] } },
      include: { photos: { select: { contentHash: true } }, realtorProfile: { include: { user: { select: { phone: true } } } } },
    });
    const duplicateCheck = detectDuplicateSignals(
      {
        title: input.title,
        description: input.description,
        area: input.area,
        city: "Abuja",
        type: input.type,
        priceNaira: BigInt(Math.round(input.priceNaira)),
        bedrooms: input.bedrooms ?? null,
        realtorProfileId: (ctx as any).realtorProfileId,
        realtorPhone: realtorProfile.user.phone,
        photoHashes: [],
      },
      candidatesInArea.map(
        (l): DuplicateCandidate => ({
          id: l.id,
          title: l.title,
          description: l.description,
          area: l.area,
          city: l.city,
          type: l.type,
          priceNaira: l.priceNaira,
          bedrooms: l.bedrooms,
          realtorProfileId: l.realtorProfileId,
          realtorPhone: l.realtorProfile.user.phone,
          photoHashes: l.photos.map((p) => p.contentHash).filter((h): h is string => !!h),
        })
      )
    );

    const duplicateFlagReason =
      duplicateCheck.score >= DUPLICATE_REVIEW_THRESHOLD
        ? `Possible duplicate: ${duplicateCheck.signals.map((s) => s.detail).join(" ")}`
        : null;
    const combinedFlagReason = [flagReason, duplicateFlagReason].filter(Boolean).join(" | ") || null;

    const listing = await ctx.db.listing.create({
      data: {
        realtorProfileId: (ctx as any).realtorProfileId,
        title: input.title,
        description: input.description,
        type: input.type,
        category: input.type === "LAND" ? null : input.category,
        priceNaira: BigInt(Math.round(input.priceNaira)),
        priceFrequency: input.type === "RENT" ? input.priceFrequency : "ONE_TIME",
        serviceChargeNaira: input.serviceChargeNaira ? BigInt(Math.round(input.serviceChargeNaira)) : undefined,
        negotiable: input.negotiable,
        furnishing: input.type === "LAND" ? "NOT_APPLICABLE" : input.furnishing,
        landSizeUnit: input.type === "LAND" ? input.landSizeUnit ?? "SQM" : undefined,
        availableFrom: input.availableFrom ? new Date(input.availableFrom) : undefined,
        locationPrecision: input.locationPrecision,
        area: input.area,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        sizeSqm: input.sizeSqm,
        videoUrl: input.type === "LAND" ? null : input.videoUrl, // belt-and-braces alongside the Zod .refine() above
        status: combinedFlagReason ? "UNDER_REVIEW" : "PENDING_REVIEW", // even in-band listings get a standard check pass — Blueprint §10 step 2
        flagReason: combinedFlagReason,
        photos: { create: input.photos.map((p, i) => ({ url: p.url, roomType: p.roomType, sortOrder: i })) },
      },
    });

    return { listing, autoFlagged: !!combinedFlagReason };
  }),

  // Realtor-side: my listings, for the dashboard table.
  mine: verifiedRealtorProcedure.query(async ({ ctx }) => {
    return ctx.db.listing.findMany({
      where: { realtorProfileId: (ctx as any).realtorProfileId },
      orderBy: { createdAt: "desc" },
      include: { photos: { take: 1 }, _count: { select: { inquiries: true } } },
    });
  }),

  setStatus: verifiedRealtorProcedure
    .input(z.object({ id: z.string(), status: z.enum(["DRAFT", "SOLD", "RENTED", "PENDING_REVIEW"]) }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.listing.findUnique({ where: { id: input.id } });
      if (!listing || listing.realtorProfileId !== (ctx as any).realtorProfileId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Sprint 4 fix (rate-limiting sweep) — this mutation had no limit at
      // all, unlike its sibling listing-create (20/day). A realtor
      // pause/resume/mark-sold loop is a real DB-write path, not a
      // read — matching the existing convention for actor-scoped writes.
      await rateLimit({ scope: "listing-set-status", identifier: (ctx as any).realtorProfileId, limit: 50, windowSeconds: 86_400 });
      // Remediation (Phase 1 trust boundary repair, item 4 / Gate B item
      // 2): LIVE is deliberately not in this endpoint's input enum at
      // all — a realtor can never self-publish, full stop, only an admin
      // approval reaches LIVE. The transition matrix additionally
      // validates every other move server-side (e.g. a realtor can't
      // "sell" a listing that's still in PENDING_REVIEW and was never
      // actually LIVE) rather than trusting any status the client sends
      // as long as it's not LIVE.
      if (!isValidListingTransition("realtor", listing.status, input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Can't move a listing from ${listing.status} to ${input.status}.`,
        });
      }

      // Sprint 1 fix — MVP Audit P1 finding "ensure SOLD is valid for sale
      // listings and RENTED for rentals" was never actually implemented:
      // the transition matrix validates the STATUS graph (e.g. LIVE→SOLD
      // is a legal move) but never cross-checked it against the listing's
      // TYPE, so a RENT listing could be marked SOLD and a SALE listing
      // could be marked RENTED. LAND is treated as sale-only, since
      // leasing land isn't a modeled workflow here.
      if (input.status === "RENTED" && listing.type !== "RENT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a RENT listing can be marked RENTED." });
      }
      if (input.status === "SOLD" && listing.type === "RENT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A RENT listing can't be marked SOLD — did you mean RENTED?" });
      }

      return ctx.db.listing.update({ where: { id: input.id }, data: { status: input.status } });
    }),

  // Admin queue — everything awaiting a moderation decision: standard
  // pending checks (PENDING_REVIEW) and price-band-flagged listings
  // (UNDER_REVIEW). Blueprint §10 step 2 / §9's price-band guardrail.
  flagged: adminProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const items = await ctx.db.listing.findMany({
        where: { status: { in: ["PENDING_REVIEW", "UNDER_REVIEW"] } },
        include: {
          photos: { take: 1 },
          realtorProfile: { select: { agencyName: true, verificationStatus: true } },
        },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: [{ status: "desc" }, { createdAt: "asc" }], // flagged (UNDER_REVIEW) surfaces above routine PENDING_REVIEW
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

  // Admin decision — approve to LIVE or remove. Logged, not applied silently.
  adminSetStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["LIVE", "REMOVED"]),
        note: z.string().optional(),
        // Readiness §3A/3C, Level 3 & 4. Optional — an admin can approve
        // without answering this, but doing so leaves ownershipEvidence at
        // its honest PENDING default rather than a false positive.
        ownershipEvidence: z.enum(["OWNER_LISTING", "AUTHORIZED_AGENT", "AGENCY_MANDATE", "DEVELOPER_LISTING", "LAND_REPRESENTATIVE"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.listing.findUnique({ where: { id: input.id } });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      // Gate B item 2 — admin side of the same transition matrix. Blocks,
      // for example, "approving" an already-SOLD listing back to LIVE.
      if (!isValidListingTransition("admin", listing.status, input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Can't move a listing from ${listing.status} to ${input.status}.`,
        });
      }

      const updated = await ctx.db.listing.update({
        where: { id: input.id },
        data: {
          status: input.status,
          flagReason: input.status === "LIVE" ? null : listing.flagReason, // clear the flag once cleared for publish
          publishedAt: input.status === "LIVE" ? new Date() : listing.publishedAt,
          // Level 3 — "listing reviewed" is true the moment an admin makes
          // ANY decision here (approve or remove), not only on approval —
          // a removed listing was still reviewed, just failed the review.
          listingReviewed: true,
          lastReviewedAt: new Date(),
          ...(input.ownershipEvidence && { ownershipEvidence: input.ownershipEvidence }),
        },
      });
      await ctx.db.listingModerationLog.create({
        data: {
          listingId: listing.id,
          fromStatus: listing.status,
          toStatus: input.status,
          note: input.note,
          actorAdminId: ctx.userId!,
        },
      });
      return updated;
    }),

  // ── Trust — reporting (Readiness §3D) ──

  report: protectedProcedure
    .input(
      z.object({
        listingId: z.string(),
        reason: z.enum([
          "DUPLICATE_LISTING", "WRONG_PRICE", "WRONG_LOCATION", "FALSE_PHOTOS",
          "PROPERTY_UNAVAILABLE", "SUSPECTED_FRAUD", "HARASSMENT", "UNAUTHORIZED_LISTING",
        ]),
        comment: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.listing.findUnique({ where: { id: input.listingId } });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      // Loose per-user cap — reporting is a trust tool, not something a
      // bad actor should be able to weaponize against a realtor by mass-
      // filing reports.
      await rateLimit({ scope: "listing-report", identifier: ctx.userId!, limit: 10, windowSeconds: 86_400 });

      return ctx.db.report.create({
        data: { listingId: input.listingId, reporterId: ctx.userId!, reason: input.reason, comment: input.comment },
      });
    }),

  adminReportsQueue: adminProcedure
    .input(z.object({ status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]).default("OPEN"), cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "OPEN";
      const limit = input?.limit ?? 20;
      const items = await ctx.db.report.findMany({
        where: { status },
        include: {
          listing: { select: { title: true, area: true, status: true, realtorProfileId: true, realtorProfile: { select: { agencyName: true } } } },
          reporter: { select: { name: true, phone: true } },
        },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: "asc" },
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

  // Resolves a report and, optionally in the same action, suspends the
  // listing and/or restricts the realtor — Readiness §3D's explicit asks
  // ("ability to suspend the listing immediately," "ability to restrict a
  // realtor after repeated reports"), both available from one screen
  // rather than requiring an admin to jump between the reports queue and
  // the listing/realtor management pages to act on what they just found.
  adminResolveReport: adminProcedure
    .input(
      z.object({
        reportId: z.string(),
        status: z.enum(["RESOLVED", "DISMISSED"]),
        resolutionNote: z.string().min(1),
        suspendListing: z.boolean().default(false),
        restrictRealtor: z.boolean().default(false),
        restrictReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.report.findUnique({ where: { id: input.reportId }, include: { listing: true } });
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.report.update({
        where: { id: input.reportId },
        data: { status: input.status, resolutionNote: input.resolutionNote, resolvedByAdminId: ctx.userId!, resolvedAt: new Date() },
      });

      if (input.suspendListing) {
        await ctx.db.listing.update({ where: { id: report.listingId }, data: { status: "REMOVED" } });
        await ctx.db.listingModerationLog.create({
          data: {
            listingId: report.listingId,
            fromStatus: report.listing.status,
            toStatus: "REMOVED",
            note: `Suspended via report resolution: ${input.resolutionNote}`,
            actorAdminId: ctx.userId!,
          },
        });
      }

      if (input.restrictRealtor) {
        await ctx.db.realtorProfile.update({
          where: { id: report.listing.realtorProfileId },
          data: { restrictedAt: new Date(), restrictedReason: input.restrictReason || input.resolutionNote },
        });
      }

      return updated;
    }),
});
