import { PHASE2_ENABLED } from "@/lib/featureFlags";

/** Sprint 3 — same freeze as app/(public)/services/layout.tsx, applied to the customer bookings surface. */
export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  if (!PHASE2_ENABLED) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-stone-900 mb-2">Bookings — coming soon</h1>
        <p className="text-sm text-stone-500">
          Home services booking is in a supervised pilot and isn't open to the public yet.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
