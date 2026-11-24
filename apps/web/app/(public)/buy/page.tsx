import { Suspense } from "react";
import type { Metadata } from "next";
import { ListingsBrowser } from "@/components/ListingsBrowser";

export const metadata: Metadata = {
  title: "Homes for sale in Abuja — ULTRA",
  description: "Browse verified completed homes for sale in Abuja — every realtor identity-checked, every listing reviewed.",
};

// Own URL per category so each is linkable and indexable. useSearchParams
// inside ListingsBrowser needs the Suspense boundary for static rendering.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ListingsBrowser type="SALE" heading="Verified homes for sale in Abuja" />
    </Suspense>
  );
}
