import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

/**
 * R2 is S3-compatible, so the standard AWS SDK works against it with a
 * custom endpoint — no separate Cloudflare-specific SDK needed.
 *
 * Like Paystack (lib/paystack.ts) and unlike OTP's SMS provider, there is
 * NO dev-mock fallback here. A fake "upload succeeded" path would let a
 * listing go live referencing a URL that serves nothing — arguably worse
 * than refusing outright, since it fails silently for the buyer looking
 * at a broken image rather than loudly for the realtor trying to upload.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB — a short walkthrough clip, not a full tour
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB — ID/CAC scans, often PDF
const MAX_MODEL_BYTES = 25 * 1024 * 1024; // 25MB — a single binary glTF (.glb) model
const ALLOWED_MODEL_TYPES = ["model/gltf-binary"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export const UPLOAD_LIMITS = {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_DOC_BYTES,
  MAX_MODEL_BYTES,
  ALLOWED_MODEL_TYPES,
  MAX_IMAGES_PER_LISTING: 10,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_DOC_TYPES,
};

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY). See .env.example."
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getPublicBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not set. See .env.example.");
  return bucket;
}

/**
 * Deliberately a SEPARATE bucket from R2_BUCKET_NAME, not a "private/"
 * prefix inside the same one — a prefix convention is only as private as
 * everyone remembering to respect it; a genuinely separate bucket with no
 * public binding configured on it can't be made to leak by a future
 * change to the public bucket's settings.
 */
function getPrivateBucketName(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET_NAME;
  if (!bucket) throw new Error("R2_PRIVATE_BUCKET_NAME is not set. See .env.example.");
  return bucket;
}

export interface PresignedUpload {
  uploadUrl: string; // client PUTs the raw file bytes here
  // Remediation (Phase 1 trust boundary repair, item 3): null for
  // verification-doc uploads. The tech spec's explicit hard requirement —
  // "private bucket + signed URLs for KYC docs, must not be publicly
  // readable" — was never actually implemented: this function previously
  // computed the SAME publicly-readable URL for verification docs as it
  // does for listing photos. Now it doesn't construct one at all for that
  // purpose; only `key` is returned, and reading the document back
  // requires generateVerificationDocReadUrl (admin-only, short-lived —
  // see below), not a permanent public link stored in the DB.
  publicUrl: string | null;
  key: string;
}

/**
 * Generates a presigned PUT URL — the client uploads directly to R2, the
 * file bytes never pass through our API server. contentType and
 * contentLength are baked into the signature, so a client can't silently
 * upload a larger file or a different type than what was validated here.
 */
export async function createPresignedUpload(params: {
  purpose: "listing-photo" | "listing-video" | "listing-model" | "verification-doc";
  contentType: string;
  contentLength: number;
  realtorProfileId: string;
}): Promise<PresignedUpload> {
  const isVideo = params.purpose === "listing-video";
  const isDoc = params.purpose === "verification-doc";
  const isModel = params.purpose === "listing-model";
  const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : isDoc ? ALLOWED_DOC_TYPES : isModel ? ALLOWED_MODEL_TYPES : ALLOWED_IMAGE_TYPES;
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : isDoc ? MAX_DOC_BYTES : isModel ? MAX_MODEL_BYTES : MAX_IMAGE_BYTES;

  if (!allowedTypes.includes(params.contentType)) {
    throw new Error(`Unsupported file type "${params.contentType}" for ${params.purpose}. Allowed: ${allowedTypes.join(", ")}`);
  }
  if (params.contentLength > maxBytes) {
    throw new Error(`File too large: ${(params.contentLength / 1024 / 1024).toFixed(1)}MB exceeds the ${maxBytes / 1024 / 1024}MB limit for ${params.purpose}.`);
  }

  // The key shape for models is load-bearing: validateModelAssetUrl() accepts only <base>/listing-model/<realtorProfileId>/<uuid>.glb
  const ext = isModel ? "glb" : params.contentType.split("/")[1];
  const key = `${params.purpose}/${params.realtorProfileId}/${randomUUID()}.${ext}`;

  // Verification docs go to a SEPARATE bucket with no public binding —
  // there is deliberately no env var analogous to R2_PUBLIC_BASE_URL for
  // it, so a public URL literally cannot be constructed for this purpose,
  // rather than relying on "just don't build the URL" as the only guard.
  const bucket = isDoc ? getPrivateBucketName() : getPublicBucketName();
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes to complete the upload

  if (isDoc) {
    return { uploadUrl, publicUrl: null, key };
  }
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!publicBaseUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is not set. See .env.example.");
  }
  return { uploadUrl, publicUrl: `${publicBaseUrl}/${key}`, key };
}

/**
 * Remediation (Phase 1 trust boundary repair, item 3) — the actual
 * "signed read URL" half of the private-bucket requirement. Short-lived
 * (5 minutes, matching the upload URL's own expiry) and generated fresh
 * on every call rather than cached — there is no standing, reusable
 * public link to a KYC document anywhere in this system after this fix.
 * Authorization (admin-only) is enforced by the ROUTER calling this
 * function (realtors.adminGetVerificationDocUrl /
 * providers.adminGetVerificationDocUrl), not by this function itself —
 * same separation-of-concerns this file already keeps between "can this
 * upload happen" (validated here) and "is this caller allowed to ask"
 * (validated by whoever calls in).
 */
export async function generateVerificationDocReadUrl(key: string): Promise<string> {
  const bucket = getPrivateBucketName();
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 300 });
}
