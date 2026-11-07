/**
 * Shared by the listing-creation form and the realtor/provider
 * verification forms — all need "get a presigned URL, PUT the file
 * directly to R2" but differ on which identifier gets stored afterward.
 * Listing photos/videos are public — the caller uses `publicUrl`.
 * Verification docs are private (Phase 1 trust boundary repair, item 3)
 * — `publicUrl` is null for that purpose, and the caller must use `key`
 * instead, later resolved to a short-lived signed URL only for an
 * authorized admin (see realtors/providers.adminGetVerificationDocUrl).
 * Returning both rather than a single string forces each call site to
 * make that choice explicitly instead of silently defaulting to whichever
 * field happens to be populated.
 */
export async function uploadFile(
  file: File,
  presign: (input: { contentType: string; contentLength: number }) => Promise<{ uploadUrl: string; publicUrl: string | null; key: string }>
): Promise<{ publicUrl: string | null; key: string }> {
  const { uploadUrl, publicUrl, key } = await presign({ contentType: file.type, contentLength: file.size });

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`Upload failed (${res.status}). The file may be too large or an unsupported type.`);
  }

  return { publicUrl, key };
}
