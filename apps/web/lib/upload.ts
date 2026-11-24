/** Shared browser upload helper. Public photos are resized before upload to reduce mobile-data use. */
async function optimiseImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || typeof createImageBitmap === "undefined") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && file.size < 450_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally { bitmap.close(); }
}

export async function uploadFile(
  originalFile: File,
  presign: (input: { contentType: string; contentLength: number }) => Promise<{ uploadUrl: string; publicUrl: string | null; key: string }>
): Promise<{ publicUrl: string | null; key: string }> {
  const file = await optimiseImage(originalFile);
  const { uploadUrl, publicUrl, key } = await presign({ contentType: file.type, contentLength: file.size });
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status}). The file may be too large or an unsupported type.`);
  return { publicUrl, key };
}
