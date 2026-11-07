import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const savedListingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const saved = await ctx.db.savedListing.findMany({
      where: { userId: ctx.userId! },
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
    const existing = await ctx.db.savedListing.findUnique({
      where: { userId_listingId: { userId: ctx.userId!, listingId: input.listingId } },
    });
    if (existing) {
      await ctx.db.savedListing.delete({ where: { userId_listingId: { userId: ctx.userId!, listingId: input.listingId } } });
      return { saved: false };
    }
    await ctx.db.savedListing.create({ data: { userId: ctx.userId!, listingId: input.listingId } });
    return { saved: true };
  }),
});
