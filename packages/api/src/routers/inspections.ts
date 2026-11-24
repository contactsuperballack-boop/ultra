import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { notify } from "../lib/notify";
import { rateLimit } from "../lib/rateLimit";
import {
  applyInspectionAction,
  availableActions,
  validateInspectionDate,
  todayInNigeria,
  kindLabel,
  slotLabel,
  formatInspectionDate,
  MAX_OPEN_REQUESTS_PER_LISTING,
  OPEN_STATUSES,
  type InspectionAction,
  type InspectionActor,
} from "@ultra/db";
import { inquiriesRouter } from "./inquiries";

const kindEnum = z.enum(["PHYSICAL", "VIRTUAL", "TITLE_DILIGENCE"]);
const slotEnum = z.enum(["MORNING", "AFTERNOON", "EVENING"]);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

const LISTING_SUMMARY = { select: { id: true, title: true, area: true, city: true } } as const;

export const inspectionsRouter = router({
  // Buyer asks to inspect a listing. Goes through the SAME inquiry path as a
  // normal message, so the per-lead fee, one-thread-per-buyer rule and
  // LIVE-only check are never bypassed.
  request: protectedProcedure
    .input(z.object({ listingId: z.string(), kind: kindEnum, preferredDate: ymd, slot: slotEnum, notes: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit({ scope: "inspection-request", identifier: ctx.userId!, limit: 10, windowSeconds: 3600 });

      const check = validateInspectionDate(input.preferredDate);
      if (!check.ok) throw new TRPCError({ code: "BAD_REQUEST", message: check.reason });

      const listing = await ctx.db.listing.findUnique({
        where: { id: input.listingId },
        include: { realtorProfile: { select: { id: true, userId: true } } },
      });
      if (!listing || listing.status !== "LIVE") throw new TRPCError({ code: "NOT_FOUND", message: "This listing isn't available." });
      if (listing.realtorProfile.userId === ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can't request an inspection of your own listing." });
      }

      const open = await ctx.db.inspectionRequest.count({
        where: { listingId: listing.id, buyerId: ctx.userId!, status: { in: [...OPEN_STATUSES] } },
      });
      if (open >= MAX_OPEN_REQUESTS_PER_LISTING) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You already have several open requests for this property. Cancel one or wait for a reply." });
      }

      const summary = `${kindLabel(input.kind)} requested for ${formatInspectionDate(input.preferredDate)}, ${slotLabel(input.slot).toLowerCase()}.${input.notes ? ` ${input.notes}` : ""}`;

      let inquiry = await ctx.db.inquiry.findFirst({ where: { listingId: listing.id, buyerId: ctx.userId! } });
      if (!inquiry) {
        // First contact on this listing: the inspection request IS the inquiry (and the billable lead).
        const created = await inquiriesRouter.createCaller(ctx).create({ listingId: listing.id, message: summary.length >= 10 ? summary : `Inspection: ${summary}` });
        inquiry = await ctx.db.inquiry.findUniqueOrThrow({ where: { id: (created as { id: string }).id } });
      } else {
        await ctx.db.message.create({ data: { inquiryId: inquiry.id, senderId: ctx.userId!, body: summary } });
      }

      const request = await ctx.db.inspectionRequest.create({
        data: {
          inquiryId: inquiry.id,
          listingId: listing.id,
          buyerId: ctx.userId!,
          kind: input.kind,
          preferredDate: toDate(input.preferredDate),
          preferredSlot: input.slot,
          notes: input.notes || null,
        },
      });

      await notify(ctx.db, {
        userId: listing.realtorProfile.userId,
        type: "INSPECTION_REQUESTED",
        title: "Inspection requested",
        body: summary.slice(0, 120),
        data: { inquiryId: inquiry.id, inspectionId: request.id },
      });
      return request;
    }),

  // Everything the buyer has asked for, newest first (buyer dashboard).
  mine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.inspectionRequest.findMany({
      where: { buyerId: ctx.userId! },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { listing: LISTING_SUMMARY },
    });
    return rows.map((row) => ({ ...row, actions: availableActions(row.status, "BUYER") }));
  }),

  // The requests on one thread. Only the buyer or the listing's realtor can read them.
  forInquiry: protectedProcedure.input(z.object({ inquiryId: z.string() })).query(async ({ ctx, input }) => {
    const inquiry = await ctx.db.inquiry.findUnique({
      where: { id: input.inquiryId },
      include: { listing: { select: { realtorProfile: { select: { userId: true } } } } },
    });
    if (!inquiry) throw new TRPCError({ code: "NOT_FOUND" });
    const isBuyer = inquiry.buyerId === ctx.userId;
    const isRealtor = inquiry.listing.realtorProfile.userId === ctx.userId;
    if (!isBuyer && !isRealtor) throw new TRPCError({ code: "FORBIDDEN" });

    const rows = await ctx.db.inspectionRequest.findMany({ where: { inquiryId: input.inquiryId }, orderBy: { createdAt: "asc" } });
    const actor: InspectionActor = isRealtor ? "REALTOR" : "BUYER";
    return { actor, items: rows.map((r) => ({ ...r, actions: availableActions(r.status, actor) })) };
  }),

  // One mutation for every follow-up so each rule is enforced in exactly one place.
  transition: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(["ACCEPT", "DECLINE", "RESCHEDULE", "CANCEL", "ACCEPT_RESCHEDULE", "COMPLETE"]),
        proposedDate: ymd.optional(),
        proposedSlot: slotEnum.optional(),
        note: z.string().trim().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.inspectionRequest.findUnique({
        where: { id: input.id },
        include: { listing: { select: { title: true, realtorProfile: { select: { userId: true, verificationStatus: true } } } } },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });

      const isBuyer = req.buyerId === ctx.userId;
      const isRealtor = req.listing.realtorProfile.userId === ctx.userId;
      if (!isBuyer && !isRealtor) throw new TRPCError({ code: "FORBIDDEN" });
      if (isRealtor && req.listing.realtorProfile.verificationStatus !== "VERIFIED") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Verified realtor account required." });
      }
      const actor: InspectionActor = isRealtor ? "REALTOR" : "BUYER";

      const outcome = applyInspectionAction(req.status, input.action as InspectionAction, actor);
      if (!outcome.ok) throw new TRPCError({ code: "BAD_REQUEST", message: outcome.reason });

      const data: Record<string, unknown> = { status: outcome.next };
      let text: string;

      if (input.action === "RESCHEDULE") {
        if (!input.proposedDate || !input.proposedSlot) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the new date and time of day." });
        const check = validateInspectionDate(input.proposedDate);
        if (!check.ok) throw new TRPCError({ code: "BAD_REQUEST", message: check.reason });
        data.proposedDate = toDate(input.proposedDate);
        data.proposedSlot = input.proposedSlot;
        text = `Proposed a new time: ${formatInspectionDate(input.proposedDate)}, ${slotLabel(input.proposedSlot).toLowerCase()}.`;
      } else if (input.action === "ACCEPT") {
        data.scheduledDate = req.preferredDate;
        data.scheduledSlot = req.preferredSlot;
        text = `Confirmed for ${formatInspectionDate(req.preferredDate)}, ${slotLabel(req.preferredSlot).toLowerCase()}.`;
      } else if (input.action === "ACCEPT_RESCHEDULE") {
        data.scheduledDate = req.proposedDate;
        data.scheduledSlot = req.proposedSlot;
        data.proposedDate = null;
        data.proposedSlot = null;
        text = `Accepted the new time: ${req.proposedDate ? formatInspectionDate(req.proposedDate) : ""}, ${req.proposedSlot ? slotLabel(req.proposedSlot).toLowerCase() : ""}.`;
      } else if (input.action === "COMPLETE") {
        if (!req.scheduledDate || req.scheduledDate.toISOString().slice(0, 10) > todayInNigeria()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can mark it complete on or after the day." });
        }
        text = "Marked as completed.";
      } else if (input.action === "DECLINE") {
        text = "Declined the request.";
      } else {
        text = "Cancelled the request.";
      }
      if (input.note) text += ` ${input.note}`;

      // Compare-and-set: if the other side acted at the same moment, don't clobber them.
      const updated = await ctx.db.inspectionRequest.updateMany({ where: { id: req.id, status: req.status }, data });
      if (updated.count === 0) throw new TRPCError({ code: "CONFLICT", message: "This request just changed. Refresh and try again." });

      await ctx.db.message.create({ data: { inquiryId: req.inquiryId, senderId: ctx.userId!, body: `Inspection update: ${text}` } });
      await notify(ctx.db, {
        userId: isBuyer ? req.listing.realtorProfile.userId : req.buyerId,
        type: "INSPECTION_UPDATED",
        title: "Inspection update",
        body: text.slice(0, 120),
        data: { inquiryId: req.inquiryId, inspectionId: req.id },
      });
      return ctx.db.inspectionRequest.findUniqueOrThrow({ where: { id: req.id } });
    }),
});
