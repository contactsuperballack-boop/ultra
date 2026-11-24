import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { rateLimit } from "../lib/rateLimit";

const savedSearchInput = z.object({
  name: z.string().trim().min(2).max(50),
  type: z.enum(["SALE", "RENT", "LAND"]).optional(),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).optional(),
  area: z.string().trim().max(80).optional(),
  query: z.string().trim().max(120).optional(),
  minPriceNaira: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  maxPriceNaira: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  minBeds: z.number().int().min(0).max(20).optional(),
  minBathrooms: z.number().int().min(0).max(20).optional(),
  verifiedOnly: z.boolean().default(false),
}).refine((value) => value.minPriceNaira === undefined || value.maxPriceNaira === undefined || value.minPriceNaira <= value.maxPriceNaira, {
  message: "Minimum price cannot exceed maximum price.",
  path: ["maxPriceNaira"],
}).refine((value) => value.type !== "LAND" || (!value.category && value.minBeds === undefined && value.minBathrooms === undefined), {
  message: "Building category and bedroom/bathroom filters do not apply to land searches.",
  path: ["type"],
});

export const savedSearchesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.savedSearch.findMany({ where: { userId: ctx.userId! }, orderBy: { createdAt: "desc" } });
  }),

  create: protectedProcedure.input(savedSearchInput).mutation(async ({ ctx, input }) => {
    await rateLimit({ scope: "saved-search-create", identifier: ctx.userId!, limit: 20, windowSeconds: 86_400 });
    const count = await ctx.db.savedSearch.count({ where: { userId: ctx.userId! } });
    if (count >= 20) throw new TRPCError({ code: "FORBIDDEN", message: "You can save up to 20 searches. Remove one before adding another." });
    return ctx.db.savedSearch.create({
      data: {
        userId: ctx.userId!,
        ...input,
        minPriceNaira: input.minPriceNaira === undefined ? null : BigInt(input.minPriceNaira),
        maxPriceNaira: input.maxPriceNaira === undefined ? null : BigInt(input.maxPriceNaira),
        area: input.area || null,
        query: input.query || null,
      },
    });
  }),

  setAlerts: protectedProcedure.input(z.object({ id: z.string(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    await rateLimit({ scope: "saved-search-alert-toggle", identifier: ctx.userId!, limit: 60, windowSeconds: 86_400 });
    const result = await ctx.db.savedSearch.updateMany({
      where: { id: input.id, userId: ctx.userId! },
      data: { alertEnabled: input.enabled },
    });
    if (!result.count) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await rateLimit({ scope: "saved-search-delete", identifier: ctx.userId!, limit: 30, windowSeconds: 86_400 });
    const result = await ctx.db.savedSearch.deleteMany({ where: { id: input.id, userId: ctx.userId! } });
    if (!result.count) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found." });
    return { success: true };
  }),
});
