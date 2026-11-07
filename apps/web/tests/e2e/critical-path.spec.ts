import { test, expect } from "@playwright/test";

/**
 * Critical path per Development Framework §27: register → verify → login →
 * use main feature → complete transaction → logout.
 *
 * Written but NOT executed in the sandboxed environment this codebase was
 * scaffolded in — no browser, no running dev server, no database there.
 * Requires: `pnpm dev:web` running against a seeded test database, and
 * NODE_ENV=test (so auth.requestOtp includes the OTP code in its response
 * for the test to read — see packages/api/src/routers/auth.ts).
 *
 * This test intercepts the tRPC network response to read the OTP code,
 * rather than trying to read server console output from the browser —
 * that's the only realistic way an E2E test can get a code that a real SMS
 * would deliver out-of-band.
 */

test("buyer can sign in, browse a listing, and send an inquiry", async ({ page }) => {
  await page.goto("/auth/login");

  const testPhone = `+2348099${Date.now().toString().slice(-6)}`; // unique per run, avoids OTP-cooldown collisions across test runs
  await page.getByPlaceholder("+2348012345678").fill(testPhone);

  // Capture the OTP code from the requestOtp response before clicking, so
  // we don't race the mutation's completion.
  const requestOtpResponse = page.waitForResponse((res) => res.url().includes("/api/trpc/auth.requestOtp") && res.status() === 200);
  await page.getByRole("button", { name: "Send code" }).click();
  const res = await requestOtpResponse;
  const body = await res.json();
  const code = body?.result?.data?.json?._testOnlyCode ?? body?.result?.data?._testOnlyCode;
  expect(code, "Expected _testOnlyCode in the response — is NODE_ENV=test set on the server?").toBeTruthy();

  await page.getByPlaceholder("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify & sign in" }).click();

  // Successful verify redirects to /dashboard/listings per LoginPage.
  await page.waitForURL(/\/dashboard\/listings/);

  // Browse the public marketplace and open a listing.
  await page.goto("/");
  await expect(page.getByText("Find a verified home")).toBeVisible();
  const firstListing = page.locator("a[href^='/listings/']").first();
  await expect(firstListing).toBeVisible({ timeout: 10_000 }); // depends on seeded LIVE listings existing
  await firstListing.click();

  // Send an inquiry — this is the core transaction of the marketplace.
  const messageInput = page.getByPlaceholder("Ask about this property\u2026");
  await expect(messageInput).toBeVisible();
  await messageInput.fill("Is this still available? E2E test message.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(/Message sent/)).toBeVisible({ timeout: 10_000 });
});

test("unauthenticated visitor can browse listings without signing in", async ({ page }) => {
  // Confirms the public marketplace doesn't accidentally require auth —
  // a real regression risk given how much of the app IS auth-gated now.
  await page.goto("/");
  await expect(page.getByText("Find a verified home")).toBeVisible();
});
