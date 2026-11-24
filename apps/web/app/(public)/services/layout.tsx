import { HOME_SERVICES_ENABLED } from "@/lib/featureFlags";

/**
 * Server-side Home Services pilot gate. The feature is included in MVP scope,
 * but routes remain unavailable unless the approved pilot environment
 * explicitly enables HOME_SERVICES_ENABLED.
 */
export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  if (!HOME_SERVICES_ENABLED) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-stone-900 mb-2">Home services — coming soon</h1>
        <p className="text-sm text-stone-500">
          Smart Home Installations, Luxury, Electrical & Plumbing, Cleaning & Move-In, and Fumigation & Pest Control will be available when the supervised pilot opens.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
