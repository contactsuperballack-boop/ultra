import { PHASE2_ENABLED } from "@/lib/featureFlags";

/**
 * Sprint 3 — the actual enforcement half of the Phase 2 freeze (see
 * lib/featureFlags.ts). Nested under app/(public)/services, so this
 * single layout covers both /services and /services/[id] without needing
 * to duplicate the check in each page component. A Server Component on
 * purpose — no client-side flash of real content before a redirect fires,
 * since the check happens before anything renders at all.
 */
export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  if (!PHASE2_ENABLED) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-stone-900 mb-2">Home services — coming soon</h1>
        <p className="text-sm text-stone-500">
          ULTRA's verified property marketplace is live. Home services (painting, plumbing, fumigation, electrical)
          is in a supervised pilot and isn't open to the public yet.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
