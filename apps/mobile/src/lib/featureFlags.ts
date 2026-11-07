import Constants from "expo-constants";

/**
 * Mirrors apps/web/lib/featureFlags.ts — same Sprint 3 freeze, read from
 * app.config.js's extra.phase2Enabled rather than process.env directly,
 * following the same pattern lib/sentry.ts already uses for build-time
 * Expo config values. Fails closed: `undefined`/anything but `true` means
 * frozen.
 */
export const PHASE2_ENABLED = Constants.expoConfig?.extra?.phase2Enabled === true;
