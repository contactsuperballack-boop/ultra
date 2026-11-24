/**
 * Thin wrapper around @sentry/node so the rest of the codebase never has to
 * check "is Sentry configured?" — reportError() is always safe to call.
 * Without SENTRY_DSN set, this is a genuine no-op (falls through to
 * console.error so the error isn't silently swallowed in dev), not a fake
 * "success" — consistent with how lib/otp.ts and lib/paystack.ts handle
 * unconfigured external services elsewhere in this codebase.
 */
import * as Sentry from "@sentry/node";

let sentryInitialized = false;

function ensureInitialized(): boolean {
  if (!process.env.SENTRY_DSN) return false;
  if (!sentryInitialized) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV, tracesSampleRate: 0.1 });
    sentryInitialized = true;
  }
  return true;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (ensureInitialized()) {
    Sentry.captureException(error, { extra: context });
  }
  // Always log locally too, regardless of Sentry — this must never be the
  // only place an error goes missing, and console output is what you'll
  // actually see in local dev where SENTRY_DSN is typically unset.
  console.error("[error]", error, context ?? "");
}
