import { Suspense } from "react";
import type { Metadata } from "next";
import { ListingsBrowser } from "@/components/ListingsBrowser";

export const metadata: Metadata = {
  title: "Land for sale in Abuja — ULTRA",
  description: "Browse plots of land in Abuja listed by identity-checked realtors.",
};

// Own URL per category so each is linkable and indexable. useSearchParams
// inside ListingsBrowser needs the Suspense boundary for static rendering.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ListingsBrowser type="LAND" heading="Verified land in Abuja" />
    </Suspense>
  );
}
