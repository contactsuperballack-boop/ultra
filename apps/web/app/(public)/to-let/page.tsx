import { Suspense } from "react";
import type { Metadata } from "next";
import { ListingsBrowser } from "@/components/ListingsBrowser";

export const metadata: Metadata = {
  title: "Properties to let in Abuja — ULTRA",
  description: "Browse verified rentals in Abuja from identity-checked realtors.",
};

// Own URL per category so each is linkable and indexable. useSearchParams
// inside ListingsBrowser needs the Suspense boundary for static rendering.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ListingsBrowser type="RENT" heading="Properties to let in Abuja" />
    </Suspense>
  );
}
