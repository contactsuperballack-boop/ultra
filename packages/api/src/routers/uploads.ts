import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, verifiedRealtorProcedure } from "../trpc";
import { createPresignedUpload, UPLOAD_LIMITS } from "../lib/storage";

export const uploadsRouter = router({
  presignListingMedia: verifiedRealtorProcedure
    .input(
      z.object({
        purpose: z.enum(["listing-photo", "listing-video"]),
        contentType: z.string(),
        contentLength: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPresignedUpload({ ...input, realtorProfileId: (ctx as any).realtorProfileId });
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (err as Error).message });
      }
    }),

  presignVerificationDoc: protectedProcedure
    .input(z.object({ contentType: z.string(), contentLength: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPresignedUpload({
          purpose: "verification-doc",
          contentType: input.contentType,
          contentLength: input.contentLength,
          realtorProfileId: ctx.userId!, // no realtorProfile exists yet at application time — key by userId instead
        });
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (err as Error).message });
      }
    }),

  limits: protectedProcedure.query(() => UPLOAD_LIMITS),
});
