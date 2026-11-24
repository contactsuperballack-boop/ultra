import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getAnalyticsProvider, PostHogAnalyticsProvider, ConsoleAnalyticsProvider } from "../../src/lib/analytics";

describe("getAnalyticsProvider", () => {
  // Snapshot and restore env vars around each test so they don't leak
  // between tests or affect other test files run in the same process —
  // same discipline as otp.test.ts's equivalent suite.
  const originalKey = process.env.POSTHOG_API_KEY;
  function restore() {
    if (originalKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = originalKey;
  }

  test("returns PostHogAnalyticsProvider when POSTHOG_API_KEY is set", () => {
    process.env.POSTHOG_API_KEY = "test-key";
    assert.ok(getAnalyticsProvider() instanceof PostHogAnalyticsProvider);
    restore();
  });

  test("returns ConsoleAnalyticsProvider when unset — including in production, unlike getSmsProvider", () => {
    delete process.env.POSTHOG_API_KEY;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    assert.ok(getAnalyticsProvider() instanceof ConsoleAnalyticsProvider);
    process.env.NODE_ENV = originalNodeEnv;
    restore();
  });
});

describe("PostHogAnalyticsProvider", () => {
  const originalKey = process.env.POSTHOG_API_KEY;
  function restore() {
    if (originalKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = originalKey;
  }

  test("throws rather than silently no-op-ing when POSTHOG_API_KEY is unset", async () => {
    delete process.env.POSTHOG_API_KEY;
    const provider = new PostHogAnalyticsProvider();
    await assert.rejects(() => provider.capture({ type: "user_registered" }), /POSTHOG_API_KEY is not set/);
    restore();
  });
});

describe("ConsoleAnalyticsProvider", () => {
  test("resolves without throwing regardless of input shape", async () => {
    const provider = new ConsoleAnalyticsProvider();
    await assert.doesNotReject(() => provider.capture({ type: "search_performed", properties: { query: "Maitama" } }));
    await assert.doesNotReject(() => provider.capture({ type: "listing_viewed" })); // no userId, no properties
  });
});
