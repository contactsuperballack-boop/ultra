import Link from "next/link";
import { RouteGuard } from "@/components/RouteGuard";
import { LowBalanceBanner } from "@/components/LowBalanceBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-emerald-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm tracking-wide">ULTRA REALTOR</span>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard/listings" className="text-emerald-100 hover:text-white">
              Listings
            </Link>
            <Link href="/dashboard/listings/new" className="text-emerald-100 hover:text-white">
              New Listing
            </Link>
            <Link href="/dashboard/inquiries" className="text-emerald-100 hover:text-white">
              Inquiries
            </Link>
            <Link href="/dashboard/verification" className="text-emerald-100 hover:text-white">
              Verification
            </Link>
            <Link href="/dashboard/billing" className="text-emerald-100 hover:text-white">
              Billing
            </Link>
            <Link href="/dashboard/subscription" className="text-emerald-100 hover:text-white">
              Subscription
            </Link>
          </nav>
        </div>
        <Link href="/notifications" className="text-emerald-100 hover:text-white text-sm">
          Notifications
        </Link>
      </div>
      <LowBalanceBanner />
      <RouteGuard>{children}</RouteGuard>
    </div>
  );
}
