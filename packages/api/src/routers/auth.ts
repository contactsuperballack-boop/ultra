import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { generateOtpCode, hashOtpCode, getSmsProvider, OTP_TTL_MS, MAX_OTP_ATTEMPTS, OTP_RESEND_COOLDOWN_MS } from "../lib/otp";
import { signAccessToken, generateRefreshToken, hashToken } from "../lib/tokens";
import { rateLimit } from "../lib/rateLimit";
import { trackEvent } from "../lib/analytics";

const phoneSchema = z.string().regex(/^\+234\d{10}$/, "Phone must be in +234XXXXXXXXXX format");

export const authRouter = router({
  requestOtp: publicProcedure.input(z.object({ phone: phoneSchema })).mutation(async ({ ctx, input }) => {
    // Per-phone cooldown already existed via the Postgres check below; the
    // Redis limits here add two things that check alone can't: a coarser
    // per-phone cap (max 5/hour, not just "wait 60s") and — importantly —
    // a per-IP cap, which stops someone cycling through many phone numbers
    // from a single source to probe or spam the SMS provider.
    if (ctx.ipAddress) {
      await rateLimit({ scope: "otp-request-ip", identifier: ctx.ipAddress, limit: 15, windowSeconds: 3600 });
    }
    await rateLimit({ scope: "otp-request-phone", identifier: input.phone, limit: 5, windowSeconds: 3600 });

    const recent = await ctx.db.otpCode.findFirst({
      where: { phone: input.phone, createdAt: { gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait before requesting another code." });
    }

    const code = generateOtpCode();
    await ctx.db.otpCode.create({
      data: { phone: input.phone, codeHash: hashOtpCode(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    await getSmsProvider().sendOtp(input.phone, code);

    // Test-only escape hatch: integration tests need the code to drive the
    // full requestOtp → verifyOtp flow without a real SMS provider. Gated
    // strictly to NODE_ENV === "test" — this branch does not exist in any
    // deployed environment's response shape.
    if (process.env.NODE_ENV === "test") {
      return { sent: true, _testOnlyCode: code };
    }

    return { sent: true };
  }),

  verifyOtp: publicProcedure
    .input(z.object({ phone: phoneSchema, code: z.string().length(6), name: z.string().min(2).optional() }))
    .mutation(async ({ ctx, input }) => {
      // Defense in depth alongside the per-code `attempts` counter below:
      // that counter is scoped to one OTP record, so it resets every time a
      // new code is requested. This IP-scoped limit catches an attacker who
      // requests a fresh code each time specifically to dodge the per-code cap.
      if (ctx.ipAddress) {
        await rateLimit({ scope: "otp-verify-ip", identifier: ctx.ipAddress, limit: 20, windowSeconds: 3600 });
      }

      const otp = await ctx.db.otpCode.findFirst({
        where: { phone: input.phone, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });

      if (!otp || otp.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Code expired or not found. Request a new one." });
      }
      if (otp.attempts >= MAX_OTP_ATTEMPTS) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many incorrect attempts. Request a new code." });
      }
      if (hashOtpCode(input.code) !== otp.codeHash) {
        await ctx.db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect code." });
      }

      await ctx.db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

      // Needed to know whether the upsert below is a genuine first-time
      // registration or just a returning user's login — Prisma's upsert
      // return value doesn't distinguish the two branches itself.
      const existingUser = await ctx.db.user.findUnique({ where: { phone: input.phone }, select: { id: true } });

      // First successful verification for this phone creates the account —
      // there's no separate "register" step; OTP verification IS registration.
      const user = await ctx.db.user.upsert({
        where: { phone: input.phone },
        update: { phoneVerified: true },
        create: { phone: input.phone, phoneVerified: true, name: input.name ?? "New User" },
      });

      // Readiness §8 — a deactivated account shouldn't be silently
      // reactivated by just logging back in. Conservative on purpose:
      // reactivation is a support conversation for now, not a self-service
      // side-effect of a successful OTP check. See docs/DATA_RETENTION.md.
      if (user.deactivatedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account has been deactivated. Contact support if you'd like to reactivate it.",
        });
      }

      // Optimization Sprint A — fired only on true first-time creation,
      // not on every returning-user login, using the pre-upsert existence
      // check above.
      if (!existingUser) {
        await trackEvent(ctx.db, { type: "user_registered", userId: user.id, properties: { role: user.role } });
      }

      const accessToken = signAccessToken({ sub: user.id, role: user.role });
      const refresh = generateRefreshToken();
      await ctx.db.refreshToken.create({
        data: { userId: user.id, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
      });

      return { accessToken, refreshToken: refresh.raw, user };
    }),

  refresh: publicProcedure.input(z.object({ refreshToken: z.string() })).mutation(async ({ ctx, input }) => {
    // Security audit fix (Medium finding — "auth.refresh Has No Rate Limit").
    // IP-scoped, not token-scoped: at this point in the request we haven't
    // looked up the token yet (that's the next line), so there's no user
    // identity to key off of — the same reasoning otp-request-ip already
    // uses for its own pre-lookup rate limit. A stolen refresh token being
    // replayed rapidly, or a rotation-logic stress attempt, both get slowed
    // down by this regardless of which specific token is being tried.
    if (ctx.ipAddress) {
      await rateLimit({ scope: "auth-refresh-ip", identifier: ctx.ipAddress, limit: 30, windowSeconds: 3600 });
    }
    const tokenHash = hashToken(input.refreshToken);
    const stored = await ctx.db.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired. Please sign in again." });
    }
    // Defense in depth — the deactivation flow already revokes every
    // refresh token, so this should be unreachable in practice, but a
    // still-valid token from a race with the deactivation itself
    // shouldn't be able to mint a fresh session either.
    if (stored.user.deactivatedAt) {
      throw new TRPCError({ code: "FORBIDDEN", message: "This account has been deactivated." });
    }

    // Rotation: the old token is revoked and replaced, not just re-validated.
    // If a revoked token is ever presented again, that's a signal of token
    // theft/reuse — worth alerting on once monitoring (Phase 7) exists.
    //
    // Concurrency fix (Execution Plan, Sprint 4 — same shape as the Sprint 1
    // fix in serviceRequests.complete): the check above runs outside the
    // transaction, so two concurrent refresh() calls presenting the SAME
    // valid token could both pass it before either commits — both would
    // then revoke the same row and each mint a new token pair, silently
    // duplicating a session from one legitimate concurrent-refresh race
    // (e.g. two tabs refreshing at once), not an attack. The updateMany's
    // WHERE clause below is the actual guard: it only revokes a row that is
    // STILL unrevoked at the moment of the write. Whichever call wins the
    // race gets `count === 1` and proceeds; the loser gets `count === 0`
    // and fails the same way a genuinely reused/stolen token already did —
    // which is the correct behavior either way, since from the DB's
    // perspective those two cases are indistinguishable at this layer.
    const next = generateRefreshToken();
    const result = await ctx.db.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedBy: next.hash },
      });
      if (count === 0) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired. Please sign in again." });
      }
      await tx.refreshToken.create({ data: { userId: stored.userId, tokenHash: next.hash, expiresAt: next.expiresAt } });
      return true;
    });

    const accessToken = signAccessToken({ sub: stored.user.id, role: stored.user.role });
    return { accessToken, refreshToken: next.raw };
  }),

  logout: protectedProcedure.input(z.object({ refreshToken: z.string() })).mutation(async ({ ctx, input }) => {
    const tokenHash = hashToken(input.refreshToken);
    await ctx.db.refreshToken.updateMany({
      where: { tokenHash, userId: ctx.userId! },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({ where: { id: ctx.userId! }, include: { realtorProfile: true } });
  }),

  // Readiness §8 — "define account deletion behavior." Soft-deactivation
  // with explicit, documented redaction — see the User.deactivatedAt
  // schema comment and docs/DATA_RETENTION.md for the full reasoning on
  // what is and isn't erased and why (financial/audit records this user
  // is party to are legitimately part of someone else's record too, and
  // are retained per that policy, not deleted).
  requestAccountDeletion: protectedProcedure
    .input(z.object({ reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.userId! },
        include: { realtorProfile: true, providerProfile: true },
      });

      await ctx.db.$transaction(async (tx) => {
        // Kill every session immediately — this is the one part of
        // deletion that genuinely takes effect right away, since it
        // doesn't depend on an access token naturally expiring the way
        // the deactivation check on login/refresh does.
        await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });

        await tx.user.update({
          where: { id: user.id },
          data: {
            deactivatedAt: new Date(),
            deactivationReason: input.reason,
            name: "Deleted user",
            pushToken: null,
          },
        });

        // A deactivated realtor/provider can't be left with live public
        // listings/offerings — those come down, logged the same way an
        // admin-initiated removal would be, not silently.
        if (user.realtorProfile) {
          const liveListings = await tx.listing.findMany({
            where: { realtorProfileId: user.realtorProfile.id, status: { in: ["LIVE", "PENDING_REVIEW", "UNDER_REVIEW"] } },
          });
          for (const listing of liveListings) {
            await tx.listing.update({ where: { id: listing.id }, data: { status: "REMOVED" } });
            await tx.listingModerationLog.create({
              data: { listingId: listing.id, fromStatus: listing.status, toStatus: "REMOVED", note: "Realtor account deactivated." },
            });
          }
        }
        if (user.providerProfile) {
          await tx.offering.updateMany({ where: { providerProfileId: user.providerProfile.id, active: true }, data: { active: false } });
        }
      });

      return { success: true };
    }),
});
