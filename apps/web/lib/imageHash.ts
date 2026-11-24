/**
 * Browser-side 64-bit difference hash (dHash).
 * This is a perceptual fingerprint, not a cryptographic integrity hash.
 * It is used only as a duplicate-review signal; it never rejects a listing.
 */
export async function calculateImageDHash(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || typeof createImageBitmap === "undefined") return undefined;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // A malformed/unsupported image should not block a listing submission;
    // it simply skips the optional duplicate-image signal.
    return undefined;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;

    context.drawImage(bitmap, 0, 0, 9, 8);
    const pixels = context.getImageData(0, 0, 9, 8).data;
    let bits = 0n;
    let bitIndex = 0n;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = (y * 9 + x) * 4;
        const right = (y * 9 + x + 1) * 4;
        const leftGray = 0.299 * pixels[left] + 0.587 * pixels[left + 1] + 0.114 * pixels[left + 2];
        const rightGray = 0.299 * pixels[right] + 0.587 * pixels[right + 1] + 0.114 * pixels[right + 2];
        if (leftGray > rightGray) bits |= 1n << bitIndex;
        bitIndex++;
      }
    }

    return bits.toString(16).padStart(16, "0");
  } finally {
    bitmap.close();
  }
}
