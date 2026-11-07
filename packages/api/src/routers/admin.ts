import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc";
import { PUBLIC_REALTOR_PROFILE_SELECT, PUBLIC_PROVIDER_PROFILE_SELECT } from "../lib/safeProjections";

/**
 * Priority-checklist fix (MVP Product Readiness Audit — "the single
 * clearest 'the business can't practically run this yet' finding"):
 * realtors.adminSearch and providers.adminSearch already existed, but
 * neither covers a plain BUYER (no profile to search against), and
 * neither is reachable from a general admin screen — only
 * admin/payments/page.tsx calls them, for the narrow purpose of finding
 * a realtor/provider to issue a refund to. If a buyer contacts support
 * with "delete my data" or a fraud report about another user, there was
 * no admin tool to find that person at all.
 *
 * This router is intentionally new rather than added to realtors.ts or
 * providers.ts — it searches the User table directly, which isn't
 * specific to either domain, and giving it its own small router keeps
 * "find any account, any role" as one clear capability rather than a
 * third near-duplicate of the existing two searches. The two existing
 * role-specific searches are left exactly as they are (still used by
 * admin/payments for their existing purpose) — this doesn't replace
 * them, it closes the gap they don't cover.
 */
export const adminRouter = router({
  // Lean, list-shaped results — deliberately not the full profile detail
  // (see userDetail below) so a search-as-you-type screen doesn't pull
  // KYC-adjacent data for every row, only for the one an admin opens.
  search: adminProcedure.input(z.object({ query: z.string().min(2) })).query(async ({ ctx, input }) => {
    const users = await ctx.db.user.findMany({
      where: {
        OR: [{ name: { contains: input.query, mode: "insensitive" } }, { phone: { contains: input.query } }],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        phoneVerified: true,
        role: true,
        deactivatedAt: true,
        createdAt: true,
        realtorProfile: { select: { id: true, verificationStatus: true } },
        providerProfile: { select: { id: true, verificationStatus: true } },
      },
      take: 15,
      orderBy: { createdAt: "desc" },
    });
    return users;
  }),

  // Full detail for one account — the screen an admin actually opens
  // after finding someone via search. Realtor/provider info uses the
  // same safe projection the public-facing endpoints use, plus a couple
  // of admin-relevant fields (balance/commission owed) that are
  // appropriate for an admin to see but were correctly excluded from the
  // public projection — mirroring the exact pattern payments.failedLeadFees
  // already established for "safe projection plus one admin-only extra."
  userDetail: adminProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        phoneVerified: true,
        email: true,
        role: true,
        deactivatedAt: true,
        deactivationReason: true,
        createdAt: true,
        pushToken: true,
        realtorProfile: { select: { ...PUBLIC_REALTOR_PROFILE_SELECT, creditBalanceNaira: true, restrictedReason: true } },
        // ProviderProfile has no restrictedReason field (confirmed against
        // the schema — that restrict-account mechanism currently only
        // exists for realtors, not providers; noting the asymmetry here
        // rather than silently working around it or inventing a field).
        providerProfile: { select: { ...PUBLIC_PROVIDER_PROFILE_SELECT, commissionOwedNaira: true } },
        _count: {
          select: {
            inquiriesSent: true,
            savedListings: true,
            serviceRequestsSent: true,
            reportsFiled: true,
          },
        },
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return user;
  }),
});
