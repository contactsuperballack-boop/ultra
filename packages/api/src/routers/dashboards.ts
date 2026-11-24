import { router, protectedProcedure, verifiedRealtorProcedure } from "../trpc";

const LISTING_STATUS = ["DRAFT", "PENDING_REVIEW", "LIVE", "UNDER_REVIEW", "SOLD", "RENTED", "REMOVED"] as const;

export const dashboardsRouter = router({
  /** Buyer workspace summary. A signed-in user may also be a realtor/provider. */
  buyerOverview: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId!;
    const homeServicesEnabled = process.env.HOME_SERVICES_ENABLED === "true" || process.env.PHASE2_ENABLED === "true";
    const [savedProperties, savedSearches, inquiries, inspections, unreadNotifications, serviceRequests, recentSaved, recentInspections, recentInquiries] = await Promise.all([
      ctx.db.savedListing.count({ where: { userId, listing: { is: { status: "LIVE" } } } }),
      ctx.db.savedSearch.count({ where: { userId } }),
      ctx.db.inquiry.count({ where: { buyerId: userId } }),
      ctx.db.inspectionRequest.count({ where: { buyerId: userId } }),
      ctx.db.notification.count({ where: { userId, readAt: null } }),
      homeServicesEnabled ? ctx.db.serviceRequest.count({ where: { customerId: userId } }) : Promise.resolve(null),
      ctx.db.savedListing.findMany({
        where: { userId, listing: { is: { status: "LIVE" } } },
        orderBy: { createdAt: "desc" }, take: 4,
        select: { listing: { select: { id: true, title: true, area: true, city: true, priceNaira: true, type: true, photos: { take: 1, select: { url: true } } } } },
      }),
      ctx.db.inspectionRequest.findMany({
        where: { buyerId: userId }, orderBy: { updatedAt: "desc" }, take: 4,
        select: { id: true, status: true, kind: true, preferredDate: true, scheduledDate: true, listing: { select: { id: true, title: true, area: true } } },
      }),
      ctx.db.inquiry.findMany({
        where: { buyerId: userId }, orderBy: { createdAt: "desc" }, take: 4,
        select: { id: true, createdAt: true, listing: { select: { id: true, title: true, area: true, status: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } } },
      }),
    ]);

    return {
      counts: { savedProperties, savedSearches, inquiries, inspections, unreadNotifications, serviceRequests },
      recentSaved: recentSaved.map((row) => row.listing),
      recentInspections,
      recentInquiries,
    };
  }),

  /** Realtor workspace: metrics and recent operational activity, scoped to the verified profile. */
  realtorOverview: verifiedRealtorProcedure.query(async ({ ctx }) => {
    const realtorProfileId = (ctx as any).realtorProfileId as string;
    const [profile, listingCounts, developmentCount, inquiryCount, inspectionCount, unreadNotifications, recentListings, recentInquiries] = await Promise.all([
      ctx.db.realtorProfile.findUniqueOrThrow({
        where: { id: realtorProfileId },
        select: { agencyName: true, verificationStatus: true, rating: true, responseTimeMins: true, creditBalanceNaira: true, subscriptionTier: true, subscriptionExpiresAt: true, identityVerified: true, businessVerified: true },
      }),
      ctx.db.listing.groupBy({ by: ["status"], where: { realtorProfileId }, _count: { _all: true } }),
      ctx.db.development.count({ where: { realtorProfileId } }),
      ctx.db.inquiry.count({ where: { listing: { realtorProfileId } } }),
      ctx.db.inspectionRequest.count({ where: { listing: { realtorProfileId } } }),
      ctx.db.notification.count({ where: { userId: ctx.userId!, readAt: null } }),
      ctx.db.listing.findMany({
        where: { realtorProfileId }, orderBy: { updatedAt: "desc" }, take: 5,
        select: { id: true, title: true, area: true, type: true, status: true, priceNaira: true, updatedAt: true, _count: { select: { inquiries: true } } },
      }),
      ctx.db.inquiry.findMany({
        where: { listing: { realtorProfileId } }, orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, createdAt: true, buyer: { select: { name: true } }, listing: { select: { id: true, title: true, area: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } } },
      }),
    ]);
    const listings = Object.fromEntries(LISTING_STATUS.map((status) => [status, 0])) as Record<(typeof LISTING_STATUS)[number], number>;
    for (const row of listingCounts) listings[row.status] = row._count._all;
    const subscriptionActive = profile.subscriptionTier === "PREMIUM" && !!profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > new Date();
    return {
      profile,
      listings,
      totals: { listings: Object.values(listings).reduce((sum, n) => sum + n, 0), liveListings: listings.LIVE, pendingReview: listings.PENDING_REVIEW, underReview: listings.UNDER_REVIEW, developments: developmentCount, inquiries: inquiryCount, inspections: inspectionCount, unreadNotifications },
      subscriptionActive,
      recentListings,
      recentInquiries,
    };
  }),
});
