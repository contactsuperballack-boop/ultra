// Integration tests explicitly exercise the Home Services MVP pilot routes.
process.env.HOME_SERVICES_ENABLED = "true";

import { beforeAll, afterAll } from "vitest";
import { db } from "@ultra/db";
import { redis } from "../../src/lib/redis";

/**
 * Integration tests require a REAL Postgres database — set DATABASE_URL to
 * a dedicated test database before running these, never the dev or prod
 * database. Recommended: a local Postgres via docker-compose (see
 * /docker-compose.yml) or a disposable Neon/Supabase branch.
 *
 * These tests were written but NOT executed in the sandboxed environment
 * this codebase was originally scaffolded in — there is no network access
 * there, so no real Postgres connection is possible. They're structured to
 * run correctly the moment DATABASE_URL points at a real database; treat
 * a first run as the actual verification, not this comment.
 */
beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Integration tests need a real test database — see tests/integration/setup.ts."
    );
  }
  if (!process.env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is not set. auth.ts and inquiries.ts now import lib/rateLimit.ts, which requires a reachable Redis at module load time — see docker-compose.yml."
    );
  }
  if (process.env.NODE_ENV !== "test") {
    throw new Error('NODE_ENV must be "test" when running integration tests — auth.ts gates a test-only code path on this.');
  }
  // Guard rail against accidentally pointing integration tests at a real
  // database — cheap insurance against a very expensive mistake.
  if (!process.env.DATABASE_URL.includes("test")) {
    throw new Error(
      `Refusing to run integration tests against a database whose URL doesn't contain "test": ${process.env.DATABASE_URL}. Use a dedicated test database.`
    );
  }
});

afterAll(async () => {
  await db.$disconnect();
  redis.disconnect();
});

/** Truncates all tables between test files — call from each suite's beforeEach/afterEach as needed. */
export async function resetDatabase() {
  const tables = [
    "Message", "Inquiry", "SavedSearch", "SavedListing", "ListingPhoto", "ListingModerationLog", "Listing",
    "Review", "VerificationLog", "PaymentTransaction", "RealtorProfile",
    // Phase 2 — same dependency-order convention as above (children before
    // parents). TRUNCATE ... CASCADE on "User" below would technically
    // clear these transitively via the FK chain even if they weren't
    // listed here, but relying on that implicitly would be undocumented
    // and fragile against future schema changes — explicit, like every
    // other table in this list.
    "ServiceOccurrence", "ServiceMilestone", "ServiceQuote", "RecurringAgreement", "ServiceMessage", "ServiceRequest", "Offering", "ProviderVerificationLog", "ProviderProfile",
    // Optimization Sprint A — AnalyticsEvent.userId is a plain string,
    // deliberately NOT a foreign key (see the schema comment — a deleted
    // user's historical events should survive, not cascade-delete), which
    // means it will NOT be cleared by TRUNCATE ... CASCADE on "User"
    // below the way every FK-linked table in this list would be. Without
    // this explicit entry, analytics rows from an earlier test would
    // silently persist into the next one and corrupt any count-based
    // assertion.
    "SupportTicketMessage", "SupportTicket",
    "AnalyticsEvent", "AdminAuditLog",
    "Notification", "RefreshToken", "OtpCode", "User",
  ];
  for (const table of tables) {
    await db.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
  await resetRateLimits();
}

/**
 * Deletes only keys under the "ratelimit:" namespace — deliberately NOT a
 * blind FLUSHDB, so this is safe to call even if REDIS_URL is ever pointed
 * at a shared instance by mistake; it can only ever remove rate-limit
 * counters this app itself created.
 *
 * This exists because tests/integration/auth.test.ts reuses the same phone
 * number across multiple test cases in one file — without clearing this
 * between tests, the phone-scoped rate limit added in lib/rateLimit.ts
 * would accumulate across those tests and cause a later, unrelated test to
 * fail with TOO_MANY_REQUESTS instead of testing what it's meant to test.
 * Caught by reviewing the rate-limiting change against the existing test
 * suite before considering it done, not by actually running it.
 */
async function resetRateLimits() {
  const keys = await redis.keys("ratelimit:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
