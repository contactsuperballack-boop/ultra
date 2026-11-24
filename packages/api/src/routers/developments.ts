import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, verifiedRealtorProcedure } from "../trpc";
import { rateLimit } from "../lib/rateLimit";
import { PUBLIC_REALTOR_PROFILE_SELECT } from "../lib/safeProjections";
import { extractYouTubeVideoId, summarizeUnits } from "@ultra/db";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const developmentInput = z
  .object({
    name: text(2, 80),
    description: text(40, 2000),
    area: text(2, 60),
    city: text(2, 60).default("Abuja"),
    architect: text(2, 80).optional(),
    builder: text(2, 80).optional(),
    developer: text(2, 80).optional(),
    completionYear: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
    youtubeUrl: z.string().trim().max(300).optional(),
  })
  .refine((d) => !d.youtubeUrl || extractYouTubeVideoId(d.youtubeUrl) !== null, {
    message: "Paste a YouTube link (watch, youtu.be or Shorts).",
    path: ["youtubeUrl"],
  });

// What a visitor may see of one unit. No status other than LIVE ever leaves the server on a public read.
const PUBLIC_UNIT_SELECT = {
  id: true,
  title: true,
  unitNumber: true,
  type: true,
  category: true,
  bedrooms: true,
  bathrooms: true,
  sizeSqm: true,
  priceNaira: true,
  priceFrequency: true,
  status: true,
  photos: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
} as const;

export const developmentsRouter = router({
  create: verifiedRealtorProcedure.input(developmentInput).mutation(async ({ ctx, input }) => {
    await rateLimit({ scope: "development-create", identifier: ctx.userId!, limit: 20, windowSeconds: 3600 });
    const { youtubeUrl, ...rest } = input;
    return ctx.db.development.create({
      data: { ...rest, realtorProfileId: ctx.realtorProfileId, youtubeVideoId: youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null },
    });
  }),

  // Only the owning realtor can edit; units are managed as ordinary listings.
  update: verifiedRealtorProcedure
    .input(z.object({ id: z.string(), data: developmentInput }))
    .mutation(async ({ ctx, input }) => {
      const dev = await ctx.db.development.findUnique({ where: { id: input.id }, select: { realtorProfileId: true } });
      if (!dev) throw new TRPCError({ code: "NOT_FOUND" });
      if (dev.realtorProfileId !== ctx.realtorProfileId) throw new TRPCError({ code: "FORBIDDEN" });
      const { youtubeUrl, ...rest } = input.data;
      return ctx.db.development.update({
        where: { id: input.id },
        data: { ...rest, youtubeVideoId: youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null, status: "PENDING", moderationNote: null, reviewedAt: null, reviewedByAdminId: null },
      });
    }),

  // The realtor's own developments, with unit counts for every status (the dashboard picker and overview).
  mine: verifiedRealtorProcedure.query(async ({ ctx }) => {
    const devs = await ctx.db.development.findMany({
      where: { realtorProfileId: ctx.realtorProfileId },
      orderBy: { createdAt: "desc" },
      include: { listings: { select: { status: true } } },
    });
    return devs.map(({ listings, ...d }) => ({
      ...d,
      unitCount: listings.length,
      liveCount: listings.filter((l) => l.status === "LIVE").length,
    }));
  }),

  // Public page data: the development once, plus only its LIVE units and their summary.
  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (ctx.ipAddress) await rateLimit({ scope: "developments-byId", identifier: ctx.ipAddress, limit: 200, windowSeconds: 60 });
    const dev = await ctx.db.development.findUnique({
      where: { id: input.id, status: "APPROVED" },
      include: {
        realtorProfile: { select: PUBLIC_REALTOR_PROFILE_SELECT },
        listings: { where: { status: "LIVE" }, orderBy: [{ unitNumber: "asc" }], select: PUBLIC_UNIT_SELECT },
      },
    });
    if (!dev) throw new TRPCError({ code: "NOT_FOUND" });
    const { listings, ...rest } = dev;
    return { ...rest, units: listings, summary: summarizeUnits(listings) };
  }),

  // Browse: only developments that currently have something available.
  list: publicProcedure
    .input(z.object({ area: z.string().trim().max(60).optional(), limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.ipAddress) await rateLimit({ scope: "developments-list", identifier: ctx.ipAddress, limit: 60, windowSeconds: 60 });
      const devs = await ctx.db.development.findMany({
        where: { status: "APPROVED", listings: { some: { status: "LIVE" } }, ...(input?.area && { area: { equals: input.area, mode: "insensitive" as const } }) },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
        include: { listings: { where: { status: "LIVE" }, select: { priceNaira: true, bedrooms: true, status: true, photos: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } } } } },
      });
      return devs.map(({ listings, ...d }) => ({ ...d, summary: summarizeUnits(listings), coverUrl: listings.find((l) => l.photos[0])?.photos[0]?.url ?? null }));
    }),
});
