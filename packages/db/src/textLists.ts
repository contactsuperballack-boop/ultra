// Small helpers for "tag" style fields (specialties, equipment, areas): turn
// what a person typed into a clean, de-duplicated, length-limited list.

/** Trim, drop empties, de-duplicate case-insensitively, cap length and count. */
export function cleanList(items: readonly string[], maxItems = 12, maxLen = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = (typeof raw === "string" ? raw : "").trim().replace(/\s+/g, " ").slice(0, maxLen);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** "a, b, c" or one item per line -> clean list. */
export function splitList(raw: string, maxItems = 12, maxLen = 60): string[] {
  return cleanList(raw.split(/[,\n]/), maxItems, maxLen);
}
