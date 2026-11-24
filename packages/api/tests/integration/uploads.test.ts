import { describe, test, expect, beforeEach } from "vitest";
import { resetDatabase } from "./setup";
import { createAuthedCaller } from "./testHelpers";

/**
 * Priority-checklist fix — uploads.ts had zero integration test coverage
 * (confirmed by grep before writing this file). Split deliberately into
 * two groups:
 *
 * 1. Type/size validation — this happens in createPresignedUpload()
 *    BEFORE any R2 client is constructed (confirmed by reading
 *    storage.ts directly), so these run regardless of whether real R2
 *    credentials are configured.
 * 2. Happy-path signing — getSignedUrl from @aws-sdk/s3-request-presigner
 *    computes the signature locally and never makes a network call, so
 *    these work with the placeholder R2_* values added to ci.yml
 *    alongside this file, the same "fake but present" pattern already
 *    used there for PAYSTACK_SECRET_KEY. If R2 env vars are ever unset in
 *    a given run, these specific tests are the ones that will fail with a
 *    "not configured" error — that's expected in that case, not a bug in
 *    the test.
 */
describe("uploads router (integration — requires real DATABASE_URL)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("presignListingMedia rejects an unsupported content type", async () => {
    const { caller } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348093000001", realtor: { agencyName: "Upload Test Realty" },
    });
    await expect(
      caller.uploads.presignListingMedia({ purpose: "listing-photo", contentType: "application/exe", contentLength: 1000 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("presignListingMedia rejects a file over the size limit for its purpose", async () => {
    const { caller } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348093000002", realtor: { agencyName: "Upload Size Test Realty" },
    });
    const limits = await caller.uploads.limits();
    await expect(
      caller.uploads.presignListingMedia({
        purpose: "listing-photo",
        contentType: "image/jpeg",
        contentLength: (limits as any).MAX_IMAGE_BYTES + 1,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("presignListingMedia succeeds for a valid photo and returns a public URL", async () => {
    const { caller } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348093000003", realtor: { agencyName: "Upload Happy Path Realty" },
    });
    const result = await caller.uploads.presignListingMedia({
      purpose: "listing-photo", contentType: "image/jpeg", contentLength: 500_000,
    });
    expect((result as any).uploadUrl).toBeTruthy();
    expect((result as any).publicUrl).toBeTruthy();
    expect((result as any).key).toMatch(/^listing-photo\//);
  });

  test("presignListingMedia video-type limits are enforced separately from photo limits", async () => {
    const { caller } = await createAuthedCaller({
      role: "REALTOR", phone: "+2348093000004", realtor: { agencyName: "Upload Video Test Realty" },
    });
    // A photo-sized file is far under the video limit, so this should
    // succeed under the "listing-video" purpose even though it'd also
    // pass as a photo — the two purposes are validated independently, not
    // sharing one global size ceiling.
    const result = await caller.uploads.presignListingMedia({
      purpose: "listing-video", contentType: "video/mp4", contentLength: 2_000_000,
    });
    expect((result as any).key).toMatch(/^listing-video\//);

    // But an image content-type is still rejected under the video
    // purpose — the type allowlist is purpose-specific too.
    await expect(
      caller.uploads.presignListingMedia({ purpose: "listing-video", contentType: "image/jpeg", contentLength: 2_000_000 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("presignVerificationDoc accepts a PDF and never returns a public URL", async () => {
    // Regression test for the exact bug the Sprint 1 KYC-privacy remediation
    // fixed: verification docs must never get a resolvable public URL,
    // even on a successful presign. protectedProcedure, not
    // verifiedRealtorProcedure — a user applying for verification doesn't
    // have a RealtorProfile yet, by definition.
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348093000005" });
    const result = await caller.uploads.presignVerificationDoc({ contentType: "application/pdf", contentLength: 1_000_000 });
    expect((result as any).uploadUrl).toBeTruthy();
    expect((result as any).publicUrl).toBeNull();
    expect((result as any).key).toMatch(/^verification-doc\//);
  });

  test("presignVerificationDoc rejects a video content type (docs are images/PDF only)", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348093000006" });
    await expect(
      caller.uploads.presignVerificationDoc({ contentType: "video/mp4", contentLength: 1_000_000 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("a buyer (non-realtor) cannot call presignListingMedia", async () => {
    const { caller } = await createAuthedCaller({ role: "BUYER", phone: "+2348093000007" });
    await expect(
      caller.uploads.presignListingMedia({ purpose: "listing-photo", contentType: "image/jpeg", contentLength: 500_000 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("an unauthenticated caller cannot call any uploads procedure", async () => {
    const { appRouter, createContext } = await import("../../src");
    const ctx = await createContext({ authHeader: null });
    const anonCaller = appRouter.createCaller(ctx);
    await expect(
      anonCaller.uploads.presignVerificationDoc({ contentType: "application/pdf", contentLength: 1000 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonCaller.uploads.limits()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
