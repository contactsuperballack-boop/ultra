/**
 * Remediation (Phase 1 trust boundary repair, item 1): every place a
 * public or buyer-facing endpoint did `include: { realtorProfile: true }`
 * (or, for providers, returned the raw profile with no select at all) was
 * leaking internal fields no external caller should ever see —
 * `creditBalanceNaira`/`commissionOwedNaira` (the account's live financial
 * balance), `idDocumentUrl` (a KYC document), `cacRegistrationNo`,
 * `restrictedReason`, `verifiedByAdminId`. These constants are the one
 * definition of "what's safe to show," reused everywhere a
 * realtor/provider profile reaches a public or buyer/customer-facing
 * response, so there's a single place to extend if a new field is added
 * to either model later — not a per-endpoint judgment call each time.
 */
export const PUBLIC_REALTOR_PROFILE_SELECT = {
  id: true,
  userId: true, // needed server-side for several ownership checks (e.g. inquiries.byId/reply) — an opaque id, not sensitive on its own, but not rendered by any current UI either
  agencyName: true,
  verificationStatus: true,
  identityVerified: true,
  businessVerified: true,
  rating: true,
  responseTimeMins: true,
  subscriptionTier: true,
  subscriptionExpiresAt: true,
} as const;

export const PUBLIC_PROVIDER_PROFILE_SELECT = {
  id: true,
  userId: true,
  businessName: true,
  categories: true,
  bio: true,
  serviceArea: true,
  contactName: true,
  contactRole: true,
  operatingSince: true,
  specialties: true,
  equipment: true,
  proofVideoIds: true,
  verificationStatus: true,
  identityVerified: true,
  businessVerified: true,
  rating: true,
  responseTimeMins: true,
  subscriptionTier: true,
  subscriptionExpiresAt: true,
} as const;
