import type { PrismaClient } from "@ultra/db";

/**
 * The six events this pass instruments — chosen to back the specific
 * metrics Readiness §10 already names (search-to-listing-view rate,
 * listing-view-to-inquiry rate, etc.) rather than a generic "track
 * everything" approach. A union type here, not a bare string, so a call
 * site typo doesn't silently create a new, disconnected event name that
 * never shows up in a dashboard built against the intended six.
 */
export type AnalyticsEventType =
  | "user_registered"
  | "listing_viewed"
  | "search_performed"
  | "inquiry_sent"
  | "service_request_created"
  | "job_completed";

interface AnalyticsEventInput {
  type: AnalyticsEventType;
  // string | null | undefined, not just string | undefined — ctx.userId
  // throughout this codebase is typed `string | null` (unauthenticated =
  // null, not undefined), and several call sites pass it straight
  // through. Narrowing this to `string | undefined` would be a real
  // type-check failure at every one of those call sites — `node --check`
  // (parse-only, used for verification in this environment) wouldn't
  // catch it, but a real `tsc` run would.
  userId?: string | null;
  properties?: Record<string, unknown>;
}

/**
 * Same seam as SmsProvider (lib/otp.ts) — a real implementation and a
 * dev/console fallback behind one interface, so the framework's own rule
 * against faking a working integration applies here too.
 */
export interface AnalyticsProvider {
  capture(event: AnalyticsEventInput): Promise<void>;
}

/** Real implementation — requires POSTHOG_API_KEY. Uses PostHog's plain HTTP capture endpoint directly rather than their SDK, since this environment can't install new npm packages to verify an SDK integration compiles. */
export class PostHogAnalyticsProvider implements AnalyticsProvider {
  async capture(event: AnalyticsEventInput): Promise<void> {
    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) {
      throw new Error("POSTHOG_API_KEY is not set — cannot send to PostHog. Use ConsoleAnalyticsProvider in development.");
    }
    const host = process.env.POSTHOG_HOST || "https://app.posthog.com";
    const res = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: event.type,
        distinct_id: event.userId ?? "anonymous",
        properties: event.properties ?? {},
      }),
    });
    if (!res.ok) {
      throw new Error(`PostHog capture failed: ${res.status} ${await res.text()}`);
    }
  }
}

/** Dev/test provider — logs the event instead of calling a real analytics service. Never used if POSTHOG_API_KEY is set. */
export class ConsoleAnalyticsProvider implements AnalyticsProvider {
  async capture(event: AnalyticsEventInput): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[ANALYTICS] ${event.type}`, { userId: event.userId ?? "anonymous", properties: event.properties ?? {} });
  }
}

export function getAnalyticsProvider(): AnalyticsProvider {
  if (process.env.POSTHOG_API_KEY) return new PostHogAnalyticsProvider();

  // Deliberately NOT the same hard production gate getSmsProvider()
  // applies. A missing SMS provider falling back silently would leak OTP
  // codes to server logs — a real security property. A missing analytics
  // provider falling back to console logging only costs you a PostHog
  // dashboard, not a security property, and the durable AnalyticsEvent
  // row below is written either way — first-party data is never lost
  // just because PostHog was never configured.
  return new ConsoleAnalyticsProvider();
}

/**
 * Single entry point for tracking an event — always writes the durable
 * AnalyticsEvent row first (so first-party analytics works even if
 * PostHog is never configured, or configured later and backfilled from
 * this table), then best-effort forwards to whatever provider
 * getAnalyticsProvider() resolves to. Mirrors notify()'s exact shape:
 * the external call is never awaited into the caller's critical path — a
 * slow or failed analytics call must never delay or fail the actual
 * user-facing action that triggered it.
 */
export async function trackEvent(db: PrismaClient, input: AnalyticsEventInput): Promise<void> {
  await db.analyticsEvent.create({
    data: { type: input.type, userId: input.userId, properties: input.properties as any },
  });

  getAnalyticsProvider()
    .capture(input)
    .catch((err) => console.error("[trackEvent] provider capture failed:", err));
}
