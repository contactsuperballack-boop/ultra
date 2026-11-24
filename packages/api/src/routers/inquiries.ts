import { z } from "zod";
import { router, protectedProcedure, verifiedRealtorProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { notify } from "../lib/notify";
import { rateLimit } from "../lib/rateLimit";
import { PUBLIC_REALTOR_PROFILE_SELECT } from "../lib/safeProjections";
import { Prisma, getPlatformConfig } from "@ultra/db";
import { trackEvent } from "../lib/analytics";

// Gate B #6 — this used to be a hardcoded constant. It's now the seeded
// DEFAULT for PlatformConfig.leadFeeNaira (see packages/db/src/platformConfig.ts),
// read live on every call rather than baked into the deployed code, so an
// admin can adjust it without a redeploy. Kept exported as a fallback
// value and for any test that wants the current default without a DB
// round-trip — NOT the source of truth once PlatformConfig exists.
export const LEAD_FEE_NAIRA = 500n;

export const inquiriesRouter = router({
  // Buyer initiates contact — this IS the billable lead event (Blueprint §12:
  // "charge for the touchpoint that already happened, not an outcome that's
  // hard to verify"). New inquiries deduct the configured lead fee from the
  // realtor's prepaid balance; see the note below on what happens if it's
  // insufficient.
  create: protectedProcedure
    .input(
      z.object({
        listingId: z.string(),
        // Readiness §5A's chargeable-lead rule: "buyer sends a meaningful
        // inquiry." The dedup branch below already satisfies the rest of
        // that rule (repeat contact on the same listing becomes a reply,
        // not a new billable event) and the LIVE-only check above satisfies
        // "listing is still active." This length floor is the one piece
        // that wasn't yet enforced — 3 characters previously let something
        // like "hi" or "??" count as a full billable lead.
        message: z.string().trim().min(10, "A real inquiry needs a bit more detail than that.").max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await ctx.db.listing.findUnique({
        where: { id: input.listingId },
        include: { realtorProfile: { select: { id: true, userId: true } } },
      });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      // Small local helper so the fast path (existing thread found up
      // front) and the race-fallback path (existing thread found only
      // because we lost a create-vs-create race — see below) share one
      // definition instead of two copies that could drift.
      async function appendToExistingThread(inquiryId: string) {
        const msg = await ctx.db.message.create({
          data: { inquiryId, senderId: ctx.userId!, body: input.message },
        });
        await notify(ctx.db, {
          userId: listing!.realtorProfile.userId,
          type: "NEW_MESSAGE",
          title: "New message",
          body: input.message.slice(0, 120),
          data: { inquiryId },
        });
        return msg;
      }

      // Bug fix: this LIVE check used to run unconditionally, before the
      // existing-thread check below — which meant a buyer with a
      // legitimate existing thread got NOT_FOUND the moment a listing left
      // LIVE (re-flagged, sold, removed), contradicting the Technical
      // Spec's own explicit edge case: "buyer inquires on a listing that
      // goes UNDER_REVIEW mid-thread (existing thread stays open, new
      // inquiries blocked)." Checking for an existing thread FIRST, and
      // only requiring LIVE for a genuinely NEW inquiry below, is what
      // actually implements that spec instead of just claiming to.
      const existing = await ctx.db.inquiry.findFirst({
        where: { listingId: input.listingId, buyerId: ctx.userId! },
      });
      if (existing) {
        // Already inquired — this is a reply in the existing thread, not a
        // new billable lead, so no fee deduction here, and no LIVE
        // requirement — an existing conversation stays open regardless of
        // what happens to the listing afterward.
        return appendToExistingThread(existing.id);
      }

      if (listing.status !== "LIVE") throw new TRPCError({ code: "NOT_FOUND" });

      // New inquiry: create it, and in the same transaction attempt to
      // deduct the lead fee. ASSUMPTION (not confirmed with the business):
      // an insufficient realtor balance does NOT block the buyer's message
      // from going through — it would be a strange product to let a
      // realtor's billing state affect whether a buyer can reach them. The
      // shortfall is recorded as a FAILED PaymentTransaction for admin
      // visibility/collection rather than silently absorbed.
      //
      // Rate limit is specifically on THIS branch (new inquiries), not
      // follow-up replies — each new inquiry costs a real realtor real
      // money, so this caps how much of that a single buyer account can
      // trigger. A buyer replying to an existing thread isn't restricted.
      await rateLimit({ scope: "new-inquiry", identifier: ctx.userId!, limit: 20, windowSeconds: 86_400 });

      const config = await getPlatformConfig(ctx.db);
      const leadFeeNaira = config.leadFeeNaira;

      try {
        const { inquiry, billingStatus } = await ctx.db.$transaction(async (tx) => {
          // Remediation (Gate B #1): the `existing` check above runs
          // outside any transaction, so two concurrent calls for the same
          // buyer+listing could both pass it before either committed —
          // both would then reach here and both attempt to create an
          // Inquiry row. The @@unique([listingId, buyerId]) constraint on
          // the schema is the actual guard: whichever call's INSERT
          // commits first wins, and the loser's `tx.inquiry.create` throws
          // a P2002 unique-violation, caught below, which falls back to
          // appending to the thread the winner just created — instead of
          // silently creating two Inquiry rows and charging the lead fee
          // twice for one buyer's one action.
          const newInquiry = await tx.inquiry.create({
            data: {
              listingId: input.listingId,
              buyerId: ctx.userId!,
              // Sprint 2 fix (MVP Audit P1): this was hardcoded `true`
              // regardless of whether the fee was actually charged,
              // making the field meaningless — nothing in the codebase
              // ever read it (grep confirms zero other references), but a
              // future admin report or reconciliation query reading it
              // would have been silently lied to. Corrected below, once
              // `sufficientBalance` is known, via an explicit update
              // inside this same transaction.
              billed: false, // corrected right after the balance check, before the transaction commits
              messages: { create: { senderId: ctx.userId!, body: input.message } },
            },
            include: { messages: true },
          });

          const profile = await tx.realtorProfile.findUniqueOrThrow({ where: { id: listing.realtorProfile.id } });
          const sufficientBalance = profile.creditBalanceNaira >= leadFeeNaira;

          if (sufficientBalance) {
            await tx.realtorProfile.update({
              where: { id: profile.id },
              data: { creditBalanceNaira: { decrement: leadFeeNaira } },
            });
          }

          // Correct the flag now that we know the real outcome — still
          // inside the same transaction as the inquiry create and the
          // PaymentTransaction write below, so all three are consistent
          // or none of them commit. Also correcting it on the in-memory
          // object being returned below: `tx.inquiry.update()`'s return
          // value is a separate object from `newInquiry`, so without this
          // line the API response sent back to the client would still
          // show the stale `billed: false` even on a successful charge —
          // caught while writing this fix, not after.
          await tx.inquiry.update({ where: { id: newInquiry.id }, data: { billed: sufficientBalance } });
          newInquiry.billed = sufficientBalance;

          await tx.paymentTransaction.create({
            data: {
              realtorProfileId: profile.id,
              type: "LEAD_FEE",
              status: sufficientBalance ? "SUCCESS" : "FAILED",
              amountNaira: leadFeeNaira,
              provider: "internal_balance",
              providerRef: `leadfee_${newInquiry.id}`,
              inquiryId: newInquiry.id,
            },
          });

          return { inquiry: newInquiry, billingStatus: sufficientBalance ? "charged" : "insufficient_balance" as const };
        });

        if (billingStatus === "insufficient_balance") {
          console.warn(`[billing] Realtor ${listing.realtorProfile.id} has insufficient balance for lead fee on inquiry ${inquiry.id}`);
        }

        await notify(ctx.db, {
          userId: listing.realtorProfile.userId,
          type: "NEW_MESSAGE",
          title: "New inquiry",
          body: input.message.slice(0, 120),
          data: { inquiryId: inquiry.id },
        });

        // Optimization Sprint A — genuinely new inquiries only. The
        // race-fallback catch below (a lost create-vs-create race,
        // appended via the shared appendToExistingThread helper) and the
        // fast-path existing-thread branch above both intentionally do
        // NOT fire this event — this is specifically the buyer's first
        // contact on this listing, backing Readiness §10's
        // listing-view-to-inquiry funnel metric.
        trackEvent(ctx.db, {
          type: "inquiry_sent",
          userId: ctx.userId,
          properties: { listingId: input.listingId, billingStatus },
        }).catch(() => {});

        return inquiry;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const raceWinner = await ctx.db.inquiry.findFirstOrThrow({
            where: { listingId: input.listingId, buyerId: ctx.userId! },
          });
          return appendToExistingThread(raceWinner.id);
        }
        throw err;
      }
    }),

  // Buyer's inbox — all threads across all listings they've messaged about.
  myThreads: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.inquiry.findMany({
      where: { buyerId: ctx.userId! },
      include: {
        // Remediation (Phase 1 trust boundary repair, item 1): a buyer
        // never needs the realtor's credit balance, KYC document URL, or
        // restriction reason — this endpoint previously returned all of
        // it via `realtorProfile: true`.
        listing: { include: { photos: { take: 1 }, realtorProfile: { select: PUBLIC_REALTOR_PROFILE_SELECT } } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Dedicated single-thread fetch — previously ThreadScreen (mobile)
  // re-queried the entire myThreads list and filtered client-side, which
  // was reasonable only at low thread counts. Enforces the same ownership
  // check either side of the conversation would need: caller must be
  // either the buyer on this inquiry, or the realtor who owns the listing.
  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const inquiry = await ctx.db.inquiry.findUnique({
      where: { id: input.id },
      include: {
        listing: { include: { photos: { take: 1 }, realtorProfile: { select: PUBLIC_REALTOR_PROFILE_SELECT } } },
        buyer: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!inquiry) throw new TRPCError({ code: "NOT_FOUND" });

    const isBuyer = inquiry.buyerId === ctx.userId;
    const isOwningRealtor = inquiry.listing.realtorProfile.userId === ctx.userId;
    if (!isBuyer && !isOwningRealtor) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this conversation." });
    }
    return inquiry;
  }),

  // Realtor's inbox — every inquiry across all of their listings.
  forRealtor: verifiedRealtorProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const items = await ctx.db.inquiry.findMany({
        where: { listing: { realtorProfileId: (ctx as any).realtorProfileId } },
        include: {
          // Readiness §4F — "Property no longer available" needs the
          // listing's current status, not just its title/area.
          listing: { select: { title: true, area: true, status: true } },
          buyer: { select: { name: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: "desc" },
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [buyerMessages, realtorMessages] = await Promise.all([
      ctx.db.message.count({ where: { readAt: null, senderId: { not: ctx.userId }, inquiry: { buyerId: ctx.userId! } } }),
      ctx.db.message.count({ where: { readAt: null, senderId: { not: ctx.userId }, inquiry: { listing: { realtorProfile: { userId: ctx.userId! } } } } }),
    ]);
    return buyerMessages + realtorMessages;
  }),

  markThreadRead: protectedProcedure.input(z.object({ inquiryId: z.string() })).mutation(async ({ ctx, input }) => {
    const inquiry = await ctx.db.inquiry.findUnique({ where: { id: input.inquiryId }, include: { listing: { include: { realtorProfile: { select: { userId: true } } } } } });
    if (!inquiry) throw new TRPCError({ code: "NOT_FOUND" });
    if (inquiry.buyerId !== ctx.userId && inquiry.listing.realtorProfile.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
    return ctx.db.message.updateMany({ where: { inquiryId: inquiry.id, senderId: { not: ctx.userId }, readAt: null }, data: { readAt: new Date() } });
  }),

  reply: protectedProcedure
    .input(z.object({ inquiryId: z.string(), message: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const inquiry = await ctx.db.inquiry.findUnique({
        where: { id: input.inquiryId },
        include: { listing: { include: { realtorProfile: { select: { userId: true } } } } },
      });
      if (!inquiry) throw new TRPCError({ code: "NOT_FOUND" });

      // Remediation (Phase 1 trust boundary repair, item 5): this
      // endpoint previously created a Message for ANY authenticated
      // caller against ANY inquiryId, with no check that the caller was
      // actually a participant — a signed-in user could inject a message
      // into a stranger's conversation, which would then render as if
      // from "the realtor" or "the buyer" depending on senderId, since
      // the UI's message-alignment logic only checks senderId against the
      // known participants. Same ownership check inquiries.byId already
      // applies, now also enforced on the endpoint that actually writes.
      const isBuyer = inquiry.buyerId === ctx.userId;
      const isOwningRealtor = inquiry.listing.realtorProfile.userId === ctx.userId;
      if (!isBuyer && !isOwningRealtor) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this conversation." });
      }

      // MVP review finding: only new-inquiry creation was rate-limited —
      // an already-participating caller could send unlimited replies into
      // a thread, with no cap on notification volume or DB writes. This
      // is deliberately more generous than the new-inquiry limit (a real
      // back-and-forth conversation can easily need more than 20 messages
      // a day), scoped per-user rather than per-thread since that's the
      // cheaper, still-effective guard against a single account spamming
      // across many threads at once.
      await rateLimit({ scope: "inquiry-reply", identifier: ctx.userId!, limit: 100, windowSeconds: 3_600 });

      // Contact stays in-app by design — Blueprint §10/§12: secure messaging
      // both protects the buyer and protects the per-lead revenue model from
      // realtors moving the relationship off-platform to dodge the fee.
      const msg = await ctx.db.message.create({
        data: { inquiryId: input.inquiryId, senderId: ctx.userId!, body: input.message },
      });

      // Notify whichever participant did NOT send this message.
      const recipientUserId = isBuyer ? inquiry.listing.realtorProfile.userId : inquiry.buyerId;
      await notify(ctx.db, {
        userId: recipientUserId,
        type: "NEW_MESSAGE",
        title: "New message",
        body: input.message.slice(0, 120),
        data: { inquiryId: inquiry.id },
      });

      return msg;
    }),
});
