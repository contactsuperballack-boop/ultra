import Link from "next/link";
import { RouteGuard } from "@/components/RouteGuard";
import { HOME_SERVICES_ENABLED } from "@/lib/featureFlags";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  // Provider onboarding remains gated until the approved Home Services
  // pilot environment explicitly enables HOME_SERVICES_ENABLED.
  if (!HOME_SERVICES_ENABLED) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-stone-900 mb-2">Provider onboarding — coming soon</h1>
          <p className="text-sm text-stone-500">
            ULTRA's home services program is in a supervised pilot with a small hand-picked cohort of providers
            and isn't open for public sign-up yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-teal-900 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm tracking-wide">ULTRA PARTNER</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/partner/dashboard" className="text-teal-100 hover:text-white">
              Overview
            </Link>
            <Link href="/partner/verification" className="text-teal-100 hover:text-white">
              Verification
            </Link>
            <Link href="/partner/profile" className="text-teal-100 hover:text-white">
              Profile
            </Link>
            <Link href="/partner/offerings" className="text-teal-100 hover:text-white">
              Offerings
            </Link>
            <Link href="/partner/requests" className="text-teal-100 hover:text-white">
              Requests
            </Link>
            <Link href="/partner/billing" className="text-teal-100 hover:text-white">
              Billing
            </Link>
            <Link href="/partner/subscription" className="text-teal-100 hover:text-white">
              Subscription
            </Link>
          </nav>
        </div>
        <Link href="/notifications" className="text-teal-100 hover:text-white text-sm">
          Notifications
        </Link>
      </div>
      <RouteGuard>{children}</RouteGuard>
    </div>
  );
}
