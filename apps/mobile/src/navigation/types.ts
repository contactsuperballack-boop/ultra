// Shared shape for any stack that pushes ListingDetailScreen — Search and
// Saved both need it, and duplicating a near-identical param list per
// stack would drift out of sync. ListingDetailScreen types its route
// against this generic shape rather than one specific stack's param list.
export type ListingDetailParams = { id: string };

export type WithListingDetail<Home extends string> = {
  [K in Home]: undefined;
} & {
  ListingDetail: ListingDetailParams;
};

// Sprint C — same reasoning as WithListingDetail above: RealtorProfileScreen
// is reachable from a listing's detail page regardless of which stack got
// there first (Search or Saved), so it's a shared fragment merged into
// each stack's own param list rather than duplicated per stack.
export type RealtorProfileParams = { id: string };

export type WithRealtorProfile = {
  RealtorProfile: RealtorProfileParams;
};
