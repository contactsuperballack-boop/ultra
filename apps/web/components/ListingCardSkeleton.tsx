/** Placeholder with the same footprint as ListingCard, so the page doesn't jump when results arrive. */
export function ListingCardSkeleton() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden animate-pulse" aria-hidden="true">
      <div className="h-44 bg-stone-200" />
      <div className="p-4 flex flex-col gap-2.5">
        <div className="h-4 w-2/3 bg-stone-200 rounded" />
        <div className="h-3 w-1/2 bg-stone-100 rounded" />
        <div className="h-5 w-1/3 bg-stone-200 rounded mt-1" />
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading listings" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}
