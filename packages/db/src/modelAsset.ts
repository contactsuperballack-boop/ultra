// Strict acceptance rule for a listing's 3D model link.
//
// A 3D model is fetched and parsed by the buyer's browser, so an arbitrary
// URL is a tracking/abuse vector and a CSP problem. ULTRA therefore accepts
// ONLY a file the realtor uploaded through ULTRA's own presigned-upload
// path, which always produces exactly this shape:
//
//   <R2_PUBLIC_BASE_URL>/listing-model/<realtorProfileId>/<uuid>.glb
//
// Anything else — another host, another realtor's folder, a different file
// type, credentials, ports, query strings or fragments — is rejected.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MAX_URL_LENGTH = 2048;

export type ModelUrlCheck = { ok: true; url: string } | { ok: false; reason: string };

export function validateModelAssetUrl(
  input: string | null | undefined,
  opts: { publicBaseUrl: string | undefined | null; realtorProfileId: string }
): ModelUrlCheck {
  if (!opts.publicBaseUrl) return { ok: false, reason: "3D models aren't enabled yet." };
  if (!input || typeof input !== "string") return { ok: false, reason: "Missing 3D model link." };
  const raw = input.trim();
  if (raw.length > MAX_URL_LENGTH) return { ok: false, reason: "3D model link is too long." };

  let url: URL;
  let base: URL;
  try {
    url = new URL(raw);
    base = new URL(opts.publicBaseUrl);
  } catch {
    return { ok: false, reason: "That isn't a valid link." };
  }

  if (url.protocol !== "https:") return { ok: false, reason: "3D model links must use https." };
  if (url.username || url.password) return { ok: false, reason: "3D model links can't contain credentials." };
  if (url.search || url.hash) return { ok: false, reason: "3D model links can't include query strings or fragments." };
  if (url.port && url.port !== "443") return { ok: false, reason: "3D model links can't use a custom port." };
  if (url.hostname.toLowerCase() !== base.hostname.toLowerCase()) {
    return { ok: false, reason: "Upload the .glb file to ULTRA instead of linking to another site." };
  }

  const basePath = base.pathname.replace(/\/+$/, "");
  const escapedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedId = opts.realtorProfileId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const shape = new RegExp(`^${escapedBase}/listing-model/${escapedId}/${UUID}\\.glb$`);
  if (!shape.test(url.pathname)) {
    return { ok: false, reason: "That file wasn't uploaded through ULTRA by this account, or isn't a .glb model." };
  }
  return { ok: true, url: url.toString() };
}
