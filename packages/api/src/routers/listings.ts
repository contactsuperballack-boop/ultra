import { z } from "zod";
import { router, publicProcedure, protectedProcedure, verifiedRealtorProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { checkPriceBand, detectDuplicateSignals, DUPLICATE_REVIEW_THRESHOLD, isValidListingTransition, LISTING_FEATURE_KEYS, sanitizeFeatures, extractYouTubeVideoId, validateModelAssetUrl, normalizeSearchForKind, monthlyEquivalentRange, effectiveSort, normalizeUnitNumber, type DuplicateCandidate } from "@ultra/db";
import { rateLimit } from "../lib/rateLimit";
import { PUBLIC_REALTOR_PROFILE_SELECT } from "../lib/safeProjections";
import { trackEvent } from "../lib/analytics";
import { notify } from "../lib/notify";

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
  minBathrooms: z.number().int().min(0).optional(),
  minPriceNaira: z.number().optional(),
  maxPriceNaira: z.number().optional(),
  verifiedOnly: z.boolean().optional(),
  sortBy: z.enum(["NEWEST", "PRICE_ASC", "PRICE_DESC"]).default("NEWEST"),
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(50).default(20),
});

const roomTypeEnum = z.enum(["FLOOR_PLAN", "LIVING_ROOM", "KITCHEN", "BEDROOM", "BATHROOM", "EXTERIOR", "OTHER"]);

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
    features: z.array(z.enum(LISTING_FEATURE_KEYS)).max(20).default([]),
    furnishing: z.enum(["FURNISHED", "UNFURNISHED", "PARTLY_FURNISHED", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
    landSizeUnit: z.enum(["SQM", "PLOTS", "ACRES", "HECTARES"]).optional(),
    availableFrom: z.string().datetime().optional(),
    locationPrecision: z.enum(["EXACT", "APPROXIMATE"]).default("APPROXIMATE"),
    area: z.string().min(2),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    sizeSqm: z.number().positive(),
    photos: z
      .array(z.object({ url: z.string().url(), roomType: roomTypeEnum.optional(), contentHash: z.string().regex(/^[a-f0-9]{16}$/i).optional() }))
      .min(1)
      .max(10), // matches UPLOAD_LIMITS.MAX_IMAGES_PER_LISTING in lib/storage.ts
    videoUrl: z.string().url().optional(),
    // Property Profile — all optional. Credits are the realtor's own claims; the listing page labels them as not independently verified.
    architect: z.string().trim().min(2).max(80).optional(),
    builder: z.string().trim().min(2).max(80).optional(),
    developer: z.string().trim().min(2).max(80).optional(),
    completionYear: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
    ownerStatement: z.string().trim().min(40).max(1500).optional(),
    statementAuthorRole: z.enum(["OWNER", "DEVELOPER", "AUTHORISED_REPRESENTATIVE"]).optional(),
    statementAuthorName: z.string().trim().min(2).max(80).optional(),
    youtubeUrl: z.string().trim().max(300).optional(),
    developmentId: z.string().optional(),
    unitNumber: z.string().trim().max(40).optional(),
    model3dUrl: z.string().trim().max(2048).optional(), // checked against the caller's own uploads inside `create` (needs the realtor's ID)
  })
  .refine((d) => !d.ownerStatement || !!d.statementAuthorRole, {
    message: "Say whether the statement is from the owner, the developer or an authorised representative.",
    path: ["statementAuthorRole"],
  })
  .refine((d) => !d.youtubeUrl || extractYouTubeVideoId(d.youtubeUrl) !== null, {
    message: "Paste a YouTube link (watch, youtu.be or Shorts).",
    path: ["youtubeUrl"],
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

async function notifySavedSearchMatches(db: typeof import("@ultra/db").db, listing: {
  id: string; title: string; type: "SALE" | "RENT" | "LAND"; category: "RESIDENTIAL" | "COMMERCIAL" | null;
  area: string; description: string; priceNaira: bigint; priceFrequency: "ONE_TIME" | "PER_YEAR" | "PER_MONTH";
  bedrooms: number | null; bathrooms: number | null; realtorProfileId: string;
}) {
  const searches = await db.savedSearch.findMany({
    where: { alertEnabled: true, OR: [{ type: null }, { type: listing.type }] },
  });
  const text = `${listing.title} ${listing.area} ${listing.description}`.toLocaleLowerCase();
  const matches = searches.filter((search) => {
    if (search.category && search.category !== listing.category) return false;
    if (search.area && !listing.area.toLocaleLowerCase().includes(search.area.toLocaleLowerCase())) return false;
    if (search.query && !text.includes(search.query.toLocaleLowerCase())) return false;
    if (search.minBeds !== null && (listing.bedrooms === null || listing.bedrooms < search.minBeds)) return false;
    if (search.minBathrooms !== null && (listing.bathrooms === null || listing.bathrooms < search.minBathrooms)) return false;
    const min = search.minPriceNaira;
    const max = search.maxPriceNaira;
    if (min !== null || max !== null) {
      let comparablePrice = listing.priceNaira;
      if (listing.type === "RENT" && listing.priceFrequency === "PER_MONTH") comparablePrice *= 12n;
      if (min !== null && comparablePrice < min) return false;
      if (max !== null && comparablePrice > max) return false;
    }
    return true;
  });
  if (!matches.length) return;

  const verified = await db.realtorProfile.findUnique({ where: { id: listing.realtorProfileId }, select: { verificationStatus: true } });
  const eligible = matches.filter((search) => !search.verifiedOnly || verified?.verificationStatus === "VERIFIED");
  if (!eligible.length) return;

  const now = new Date();
  await Promise.all(eligible.map((search) => notify(db, {
    userId: search.userId,
    type: "SAVED_SEARCH_MATCH",
    title: "A property matches your saved search",
    body: `${listing.title} in ${listing.area} is now available to explore.`,
    data: { listingId: listing.id, savedSearchId: search.id },
  })));
  await db.savedSearch.updateMany({ where: { id: { in: eligible.map((search) => search.id) } }, data: { lastMatchedAt: now } });
}

export const listingsRouter = router({
  // Public search — powers both the web marketplace and the mobile Search tab.
  // Premium-subscribed realtors' listings rank first (Decision 1: subscription
  // tier affects visibility, not a paid-placement-only model) — expired
  // subscriptions (subscriptionExpiresAt in the past) do NOT get the boost,
  // checked here rather than trusting the tier field alone.
  search: publicProcedure.input(searchInput).query(async ({ ctx, input: rawInput }) => {
    // Category-aware: a land search never filters on bedrooms or building category, even if a hand-built request sends them.
    const input = normalizeSearchForKind(rawInput);
    const sortBy = effectiveSort(input.type, input.sortBy);
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

    // Rentals mix per-year and per-month prices; compare like with like by also matching the monthly equivalent of the annual range.
    const hasPrice = Object.keys(priceFilter).length > 0;
    const monthly = monthlyEquivalentRange(input.minPriceNaira, input.maxPriceNaira);
    const monthlyFilter: { gte?: bigint; lte?: bigint } = {};
    if (monthly.min !== undefined) monthlyFilter.gte = BigInt(monthly.min);
    if (monthly.max !== undefined) monthlyFilter.lte = BigInt(monthly.max);
    const priceClause =
      input.type === "RENT"
        ? {
            OR: [
              { priceFrequency: { not: "PER_MONTH" as const }, priceNaira: priceFilter },
              { priceFrequency: "PER_MONTH" as const, priceNaira: monthlyFilter },
            ],
          }
        : { priceNaira: priceFilter };

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
      ...(input.minBathrooms !== undefined && { bathrooms: { gte: input.minBathrooms } }),
      ...(hasPrice && { AND: [priceClause] }),
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
      orderBy:
        sortBy === "PRICE_ASC"
          ? [{ priceNaira: "asc" as const }, { id: "asc" as const }]
          : sortBy === "PRICE_DESC"
            ? [{ priceNaira: "desc" as const }, { id: "asc" as const }]
            : { publishedAt: "desc" as const },
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
    // The Premium boost only applies to the default newest-first order; it would scramble an explicit price sort.
    if (sortBy === "NEWEST") items.sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)));

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

  compare: publicProcedure.input(z.object({ ids: z.array(z.string().min(1).max(128)).min(2).max(4).refine((ids) => new Set(ids).size === ids.length, "Choose each property only once.") })).query(async ({ ctx, input }) => {
    if (ctx.ipAddress) await rateLimit({ scope: "listings-compare", identifier: ctx.ipAddress, limit: 60, windowSeconds: 60 });
    const rows = await ctx.db.listing.findMany({
      where: { id: { in: input.ids }, status: "LIVE" },
      include: {
        photos: { orderBy: { sortOrder: "asc" }, take: 1 },
        realtorProfile: { select: { agencyName: true, verificationStatus: true } },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row] as const));
    // Preserve the buyer's selected order, while silently omitting listings
    // that have since become private or unavailable.
    return input.ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  }),

  // Home-page "Explore by location" — real counts of LIVE listings per area,
  // never hardcoded marketing numbers. Same IP rate limiting as search.
  areaCounts: publicProcedure
    .input(z.object({ type: z.enum(["SALE", "RENT", "LAND"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.ipAddress) {
        await rateLimit({ scope: "listings-areaCounts", identifier: ctx.ipAddress, limit: 60, windowSeconds: 60 });
      }
      const rows = await ctx.db.listing.groupBy({
        by: ["area"],
        where: { status: "LIVE", ...(input?.type && { type: input.type }) },
        _count: { _all: true },
      });
      return rows.map((r) => ({ area: r.area, count: r._count._all })).sort((a, b) => b.count - a.count);
    }),

  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (ctx.ipAddress) {
      await rateLimit({ scope: "listings-byId", identifier: ctx.ipAddress, limit: 200, windowSeconds: 60 });
    }
    const listing = await ctx.db.listing.findUnique({
      where: { id: input.id },
      include: {
        photos: { orderBy: { sortOrder: "asc" } },
        realtorProfile: { select: PUBLIC_REALTOR_PROFILE_SELECT },
        development: { select: { id: true, name: true, area: true, city: true, architect: true, builder: true, developer: true, completionYear: true, status: true } },
      },
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

    // A LIVE unit may still be visible independently, but an unreviewed or
    // rejected parent development must never leak into its public profile.
    return { ...listing, development: listing.development?.status === "APPROVED" ? listing.development : null };
  }),

  // Realtor-side: create + submit for verification. Requires a VERIFIED realtor account —
  // Blueprint §9: "every realtor is verified before they can publish a listing."
  create: verifiedRealtorProcedure.input(createListingInput).mutation(async ({ ctx, input }) => {
    // Audit finding: a compromised or malicious realtor account could
    // previously spam listings with no limit at all.
    // Units of a development get their own, higher daily allowance: a 30-unit estate must be creatable in one sitting,
    // while stand-alone listings keep the tighter anti-spam cap.
    await rateLimit(
      input.developmentId
        ? { scope: "listing-create-unit", identifier: (ctx as any).realtorProfileId, limit: 100, windowSeconds: 86_400 }
        : { scope: "listing-create", identifier: (ctx as any).realtorProfileId, limit: 20, windowSeconds: 86_400 }
    );

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

    const isLand = input.type === "LAND";

    // Unit of a development: the parent must be this realtor's own, and the unit number must be new within it.
    let unitNumber: string | null = null;
    if (input.developmentId) {
      const dev = await ctx.db.development.findUnique({ where: { id: input.developmentId }, select: { realtorProfileId: true } });
      if (!dev || dev.realtorProfileId !== (ctx as any).realtorProfileId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose one of your own developments." });
      }
      unitNumber = normalizeUnitNumber(input.unitNumber);
      if (!unitNumber) throw new TRPCError({ code: "BAD_REQUEST", message: "Add a unit number (letters, numbers, spaces, - or /, up to 20 characters)." });
      const clash = await ctx.db.listing.findFirst({ where: { developmentId: input.developmentId, unitNumber }, select: { id: true } });
      if (clash) throw new TRPCError({ code: "CONFLICT", message: `Unit ${unitNumber} already exists in this development.` });
    } else if (input.unitNumber) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A unit number only applies to a unit of a development." });
    }

    // 3D model: only a .glb this realtor uploaded through ULTRA is accepted (fails closed if storage isn't configured).
    let model3dUrl: string | null = null;
    if (!isLand && input.model3dUrl) {
      const check = validateModelAssetUrl(input.model3dUrl, { publicBaseUrl: process.env.R2_PUBLIC_BASE_URL, realtorProfileId: (ctx as any).realtorProfileId });
      if (!check.ok) throw new TRPCError({ code: "BAD_REQUEST", message: check.reason });
      model3dUrl = check.url;
    }

    const flagReason = checkPriceBand(input.area, input.priceNaira, input.sizeSqm);

    // Readiness §3B — deterministic duplicate detection. Address-based
    // candidates are scoped to the same area; image-hash candidates are
    // searched across areas because the same property photos can be reused
    // under a different location/contact (the documented hijacking pattern).
    const submittedPhotoHashes = input.photos.map((photo) => photo.contentHash).filter((hash): hash is string => !!hash);
    const candidatesInArea = await ctx.db.listing.findMany({
      where: {
        status: { notIn: ["REMOVED"] },
        OR: [
          { area: input.area },
          ...(submittedPhotoHashes.length ? [{ photos: { some: { contentHash: { not: null } } } }] : []),
        ],
      },
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
        photoHashes: submittedPhotoHashes,
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
        features: sanitizeFeatures(input.features, input.type),
        // Building credits don't apply to a plot; the statement and film do.
        architect: isLand ? null : input.architect ?? null,
        builder: isLand ? null : input.builder ?? null,
        developer: isLand ? null : input.developer ?? null,
        completionYear: isLand ? null : input.completionYear ?? null,
        ownerStatement: input.ownerStatement ?? null,
        statementAuthorRole: input.ownerStatement ? input.statementAuthorRole : null,
        statementAuthorName: input.ownerStatement ? input.statementAuthorName ?? null : null,
        youtubeVideoId: input.youtubeUrl ? extractYouTubeVideoId(input.youtubeUrl) : null, // only the validated ID is stored
        model3dUrl,
        developmentId: input.developmentId ?? null,
        unitNumber,
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
        photos: { create: input.photos.map((p, i) => ({ url: p.url, roomType: p.roomType, contentHash: p.contentHash, sortOrder: i })) },
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
          // Admin review must expose every public-facing asset and claim,
          // not just the cover photo. Approval is an explicit decision that
          // the reviewer has inspected the same content buyers will see.
          photos: { orderBy: { sortOrder: "asc" } },
          development: {
            select: {
              id: true,
              name: true,
              description: true,
              area: true,
              city: true,
              architect: true,
              builder: true,
              developer: true,
              completionYear: true,
              youtubeVideoId: true,
            },
          },
          realtorProfile: {
            select: {
              agencyName: true,
              verificationStatus: true,
              user: { select: { name: true, phone: true } },
            },
          },
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
      if (input.status === "LIVE" && listing.status !== "LIVE") {
        // Alert delivery is best-effort: a notification failure must never
        // roll back an admin's successful moderation decision.
        await notifySavedSearchMatches(ctx.db, {
          id: updated.id, title: updated.title, type: updated.type, category: updated.category,
          area: updated.area, description: updated.description, priceNaira: updated.priceNaira,
          priceFrequency: updated.priceFrequency, bedrooms: updated.bedrooms, bathrooms: updated.bathrooms,
          realtorProfileId: updated.realtorProfileId,
        }).catch((error) => console.error("[saved-search-alert] delivery failed:", error));
      }
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
