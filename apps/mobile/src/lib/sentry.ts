import * as Sentry from "sentry-expo";
import Constants from "expo-constants";

/**
 * Mirrors packages/api/src/lib/sentry.ts's philosophy: safe to call
 * unconditionally, genuine no-op without a DSN configured (not a fake
 * "it's working" state). Reads from app.json's extra.sentryDsn rather than
 * process.env directly, since Expo apps bundle config at build time —
 * see eas.json for how this differs per build profile.
 */
export function initSentry(): void {
  const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
  if (!dsn) {
    console.log("[sentry] No DSN configured (extra.sentryDsn) — error reporting disabled, console only.");
    return;
  }
  Sentry.init({
    dsn,
    enableInExpoDevelopment: false,
    debug: false,
    tracesSampleRate: 0.1,
  });
}
