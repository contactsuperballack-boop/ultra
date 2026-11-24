/**
 * Readiness §3B. Deliberately deterministic, not ML — the same instinct
 * behind checkPriceBand.ts: a simple, explainable check that catches the
 * common cases cheaply beats an opaque model at this stage, and every
 * match here still routes to a human (the admin flagged-listings queue),
 * never an auto-delete.
 *
 * The Zillow research behind this (see ZILLOW_ANALYSIS.md §2) specifically
 * flagged "listing hijacking" — a real listing's details reused under a
 * different type/contact — as a documented real-world pattern, which is
 * why crossType is checked even though same-type duplicates are the more
 * obvious case.
 */

export interface DuplicateCandidate {
  id?: string; // absent for a not-yet-created listing being checked pre-insert
  title: string;
  description: string;
  area: string;
  city: string;
  type: "SALE" | "RENT" | "LAND";
  priceNaira: bigint;
  bedrooms: number | null;
  realtorProfileId: string;
  realtorPhone: string;
  photoHashes: string[]; // ListingPhoto.contentHash values, nulls filtered out by the caller
}

export interface DuplicateSignal {
  kind:
    | "same_address_and_price"
    | "same_address_cross_type" // the listing-hijacking pattern specifically
    | "same_realtor_near_duplicate"
    | "reused_phone_different_realtor"
    | "matching_image_hash"
    | "similar_title";
  detail: string;
  weight: number;
}

export interface DuplicateCheckResult {
  matchedListingIds: string[];
  signals: DuplicateSignal[];
  score: number; // sum of signal weights across all matches — a rough severity ranking for the admin queue, not a probability
}

function perceptualHashesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // dHash values are 64-bit hexadecimal strings. A Hamming distance of six
  // or fewer catches modest resize/recompression changes while keeping the
  // signal conservative. Legacy/non-dHash values retain exact-match logic.
  if (!/^[0-9a-f]{16}$/i.test(a) || !/^[0-9a-f]{16}$/i.test(b)) return false;
  let value = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let distance = 0;
  while (value && distance <= 6) {
    value &= value - 1n;
    distance++;
  }
  return distance <= 6;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cheap word-overlap similarity — deliberately not Levenshtein/embeddings; Readiness §3B asks for deterministic, not sophisticated. */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.min(wordsA.size, wordsB.size);
}

export function detectDuplicateSignals(candidate: DuplicateCandidate, existing: DuplicateCandidate[]): DuplicateCheckResult {
  const signals: DuplicateSignal[] = [];
  const matchedIds = new Set<string>();

  const candidateAddress = normalize(`${candidate.area} ${candidate.city}`);

  for (const other of existing) {
    if (other.id && candidate.id && other.id === candidate.id) continue;

    const sameAddress = normalize(`${other.area} ${other.city}`) === candidateAddress;
    const samePrice = other.priceNaira === candidate.priceNaira;
    const sameBedrooms = other.bedrooms === candidate.bedrooms;

    // The listing-hijacking pattern: identical address+price, but the
    // *type* differs (a SALE listing's details reused as a RENT listing,
    // or vice versa) — checked before the same-type case since it's the
    // more specific, higher-severity match.
    if (sameAddress && samePrice && other.type !== candidate.type) {
      signals.push({
        kind: "same_address_cross_type",
        detail: `Same address and price as an existing ${other.type} listing, but posted as ${candidate.type} — matches the listing-hijacking pattern (real listing's details reused under a different type/contact).`,
        weight: 40,
      });
      matchedIds.add(other.id ?? "pending");
    } else if (sameAddress && samePrice && sameBedrooms) {
      const sameRealtor = other.realtorProfileId === candidate.realtorProfileId;
      signals.push({
        kind: sameRealtor ? "same_realtor_near_duplicate" : "same_address_and_price",
        detail: sameRealtor
          ? "Same realtor already has a listing at this address, price, and bedroom count — likely a duplicate submission."
          : "A different realtor already has a listing at this exact address, price, and bedroom count — the classic duplicate-plot-sale pattern.",
        weight: sameRealtor ? 15 : 35,
      });
      matchedIds.add(other.id ?? "pending");
    }

    if (other.realtorPhone === candidate.realtorPhone && other.realtorProfileId !== candidate.realtorProfileId) {
      signals.push({
        kind: "reused_phone_different_realtor",
        detail: "This contact phone number is already associated with a different realtor account.",
        weight: 25,
      });
      matchedIds.add(other.id ?? "pending");
    }

    if (candidate.photoHashes.length > 0 && other.photoHashes.length > 0) {
      const shared = candidate.photoHashes.filter((h) => other.photoHashes.some((existingHash) => perceptualHashesMatch(h, existingHash)));
      if (shared.length > 0) {
        signals.push({
          kind: "matching_image_hash",
          detail: `${shared.length} photo(s) are perceptually similar to an existing listing's images.`,
          weight: 30,
        });
        matchedIds.add(other.id ?? "pending");
      }
    }

    const titleSimilarity = wordOverlap(candidate.title, other.title);
    if (titleSimilarity >= 0.7 && !sameAddress) {
      // Similar title at a DIFFERENT address is a weaker, different signal
      // than the address-based ones above — worth surfacing, not worth the
      // same weight, since titles are often genuinely formulaic ("3
      // Bedroom Duplex in Maitama") across unrelated listings.
      signals.push({
        kind: "similar_title",
        detail: `Title is a ${Math.round(titleSimilarity * 100)}% word-overlap match with an existing listing at a different address.`,
        weight: 8,
      });
      matchedIds.add(other.id ?? "pending");
    }
  }

  return {
    matchedListingIds: [...matchedIds],
    signals,
    score: signals.reduce((sum, s) => sum + s.weight, 0),
  };
}

/** Score threshold above which listings.create routes to UNDER_REVIEW instead of auto-publishing — same "flag, never auto-delete" principle Readiness §3B states explicitly. */
export const DUPLICATE_REVIEW_THRESHOLD = 30;
