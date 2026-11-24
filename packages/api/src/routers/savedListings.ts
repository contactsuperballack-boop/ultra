import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { rateLimit } from "../lib/rateLimit";

export const savedListingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const saved = await ctx.db.savedListing.findMany({
      where: { userId: ctx.userId!, listing: { is: { status: "LIVE" } } },
      include: {
        listing: {
          include: { photos: { take: 1 }, realtorProfile: { select: { agencyName: true, verificationStatus: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return saved.map((s) => s.listing);
  }),

  // Returns just the ids — cheap way for Search/Detail screens to know
  // which hearts should render filled without pulling full listing data twice.
  ids: protectedProcedure.query(async ({ ctx }) => {
    const saved = await ctx.db.savedListing.findMany({ where: { userId: ctx.userId! }, select: { listingId: true } });
    return saved.map((s) => s.listingId);
  }),

  toggle: protectedProcedure.input(z.object({ listingId: z.string() })).mutation(async ({ ctx, input }) => {
    await rateLimit({ scope: "saved-listing-toggle", identifier: ctx.userId!, limit: 100, windowSeconds: 86_400 });
    const existing = await ctx.db.savedListing.findUnique({
      where: { userId_listingId: { userId: ctx.userId!, listingId: input.listingId } },
    });
    if (existing) {
      await ctx.db.savedListing.delete({ where: { userId_listingId: { userId: ctx.userId!, listingId: input.listingId } } });
      return { saved: false };
    }

    const listing = await ctx.db.listing.findUnique({ where: { id: input.listingId }, select: { status: true } });
    if (!listing || listing.status !== "LIVE") {
      // Do not let a buyer use the saved-listings API to bookmark or
      // enumerate a draft, flagged, removed or otherwise private listing.
      throw new TRPCError({ code: "NOT_FOUND", message: "This property is not currently available to save." });
    }
    await ctx.db.savedListing.create({ data: { userId: ctx.userId!, listingId: input.listingId } });
    return { saved: true };
  }),
});
