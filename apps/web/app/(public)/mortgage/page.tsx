import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MortgageCalculator } from "@/components/MortgageCalculator";
import { MORTGAGE_ENABLED } from "@/lib/featureFlags";

export const metadata: Metadata = {
  title: MORTGAGE_ENABLED ? "Mortgage calculator — ULTRA" : "Mortgage — coming soon — ULTRA",
  description: MORTGAGE_ENABLED
    ? "Estimate monthly repayments on a home in Abuja. An illustration only — not a loan offer."
    : "Mortgage information is coming to ULTRA. ULTRA is not a lender or broker.",
};

export default function Page() {
  if (!MORTGAGE_ENABLED) {
    return (
      <main className="max-w-xl mx-auto px-5 py-20 text-center">
        <div className="text-xs tracking-widest text-stone-500 font-mono mb-2">MORTGAGE</div>
        <h1 className="text-3xl font-semibold text-stone-900 mb-3">Coming soon</h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          We're not offering mortgage or financing information yet. ULTRA is not a lender or broker, and we'll only add this once it has been properly reviewed.
        </p>
        <Link href="/buy" className="inline-block mt-6 text-sm font-semibold text-emerald-800">Browse homes for sale →</Link>
      </main>
    );
  }
  return (
    <Suspense fallback={null}>
      <MortgageCalculator />
    </Suspense>
  );
}
