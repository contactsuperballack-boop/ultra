import { Suspense } from "react";
import type { Metadata } from "next";
import { ListingsBrowser } from "@/components/ListingsBrowser";

export const metadata: Metadata = {
  title: "Search properties in Abuja — ULTRA",
  description: "Search verified homes, rentals and land across Abuja.",
};

// Own URL per category so each is linkable and indexable. useSearchParams
// inside ListingsBrowser needs the Suspense boundary for static rendering.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ListingsBrowser heading="Search all Abuja properties" />
    </Suspense>
  );
}
