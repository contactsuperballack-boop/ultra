import type { PrismaClient } from "@ultra/db";
import { getPushProvider } from "./push";

type NotificationType =
  | "NEW_MESSAGE"
  | "INSPECTION_REQUESTED"
  | "INSPECTION_UPDATED"
  | "VERIFICATION_APPROVED"
  | "VERIFICATION_REJECTED"
  | "NEW_BOOKING_REQUEST"
  | "BOOKING_ACCEPTED"
  | "BOOKING_DECLINED"
  | "BOOKING_COMPLETED"
  | "SAVED_SEARCH_MATCH"
  | "SERVICE_PROPOSAL_READY"
  | "SERVICE_PROPOSAL_ACCEPTED"
  | "SERVICE_PROPOSAL_DECLINED"
  | "SERVICE_MILESTONE_UPDATED"
  | "SERVICE_VISIT_SCHEDULED"
  | "SERVICE_VISIT_COMPLETED";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Single entry point for notifying a user — always writes the durable
 * in-app row first (so notification history works even without push
 * permission granted), then best-effort sends a push if the user has a
 * token on file. Called from inquiries.ts (message events) and
 * realtors.ts (verification decisions) — see Technical Spec for the
 * full trigger list.
 */
export async function notify(db: PrismaClient, input: NotifyInput): Promise<void> {
  const [user] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { pushToken: true, notificationPreference: { select: { push: true } } } }),
    db.notification.create({
      data: { userId: input.userId, type: input.type, title: input.title, body: input.body, data: input.data },
    }),
  ]);

  if (user?.pushToken && (user.notificationPreference?.push ?? true)) {
    // Never awaited into the caller's critical path — a slow or failed push
    // send should not delay or fail the message/verification action itself.
    getPushProvider()
      .send(user.pushToken, input.title, input.body, input.data)
      .catch((err) => console.error("[notify] push send failed:", err));
  }
}
