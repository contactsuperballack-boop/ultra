import { initTRPC, TRPCError } from "@trpc/server";
import { db } from "@ultra/db";
import superjson from "superjson";
import { verifyAccessToken, type AccessTokenPayload } from "./lib/tokens";

/**
 * Context — created per-request from the incoming Authorization header.
 * `userId`/`userRole` come straight from the verified JWT payload, not a
 * DB lookup, so authenticated requests don't pay an extra query just to
 * know who's asking. Endpoints that need fresher user data query for it
 * explicitly (see auth.me).
 */
export interface Context {
  db: typeof db;
  userId: string | null;
  userRole: AccessTokenPayload["role"] | null;
  ipAddress: string | null;
}

export async function createContext(opts: { authHeader: string | null; ipAddress?: string | null }): Promise<Context> {
  const token = opts.authHeader?.startsWith("Bearer ") ? opts.authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;
  return { db, userId: payload?.sub ?? null, userRole: payload?.role ?? null, ipAddress: opts.ipAddress ?? null };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson, // handles BigInt (priceNaira) and Date across the wire
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires a signed-in user of any role. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/**
 * Requires ADMIN or SUPER_ADMIN.
 *
 * Sprint 2 fix (MVP Audit P1 — "authentication and role state need fresher
 * revocation semantics"): unlike verifiedRealtorProcedure/verifiedProviderProcedure,
 * which already re-check their profile's status against the DB on every call,
 * this procedure used to trust `ctx.userRole` straight from the JWT with no
 * DB round-trip at all. That's a deliberate, reasonable tradeoff for
 * high-volume buyer/realtor traffic, but admin actions are inherently
 * low-volume and high-sensitivity — the cost of one extra indexed lookup
 * per admin action is worth closing the window where a deactivated admin's
 * still-valid access token (up to 15 minutes, per tokens.ts's ACCESS_TOKEN_TTL)
 * would otherwise keep working. There is currently no admin-initiated
 * suspension endpoint for OTHER users (only self-service requestAccountDeletion,
 * which already revokes refresh tokens in the same transaction), so this
 * specifically covers the direct-DB-edit case docs/OPERATIONAL_CHECKLISTS.md
 * describes for handling a compromised admin account — that edit now takes
 * effect immediately instead of up to 15 minutes later.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.userRole !== "ADMIN" && ctx.userRole !== "SUPER_ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
  const user = await ctx.db.user.findUnique({ where: { id: ctx.userId! }, select: { deactivatedAt: true } });
  if (user?.deactivatedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This account has been deactivated." });
  }
  return next({ ctx });
});

/** Requires SUPER_ADMIN specifically — role/system-config changes only. Same live-deactivation check as adminProcedure. */
export const superAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.userRole !== "SUPER_ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required." });
  }
  const user = await ctx.db.user.findUnique({ where: { id: ctx.userId! }, select: { deactivatedAt: true } });
  if (user?.deactivatedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This account has been deactivated." });
  }
  return next({ ctx });
});

/** Requires a signed-in user whose RealtorProfile is VERIFIED. */
export const verifiedRealtorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const profile = await ctx.db.realtorProfile.findUnique({ where: { userId: ctx.userId! } });
  if (!profile || profile.verificationStatus !== "VERIFIED") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Verified realtor account required." });
  }
  return next({ ctx: { ...ctx, realtorProfileId: profile.id } });
});

/**
 * Phase 2 — requires a signed-in user whose ProviderProfile is VERIFIED.
 * Exact mirror of verifiedRealtorProcedure by design: same trust gate, same
 * shape, just checked against ProviderProfile instead of RealtorProfile.
 */
export const verifiedProviderProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const profile = await ctx.db.providerProfile.findUnique({ where: { userId: ctx.userId! } });
  if (!profile || profile.verificationStatus !== "VERIFIED") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Verified service provider account required." });
  }
  return next({ ctx: { ...ctx, providerProfileId: profile.id } });
});
