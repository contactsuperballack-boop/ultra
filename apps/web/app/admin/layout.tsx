import Link from "next/link";
import { RouteGuard } from "@/components/RouteGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="border-b border-stone-200 bg-stone-900 text-white px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-sm tracking-wide">ULTRA ADMIN</span>
        <nav className="flex gap-4 text-sm overflow-x-auto">
          <Link href="/admin" className="text-stone-300 hover:text-white">Overview</Link>
          <Link href="/admin/support" className="text-stone-300 hover:text-white">Support Desk</Link>
          <Link href="/admin/verification" className="text-stone-300 hover:text-white">
            Realtor Verification
          </Link>
          <Link href="/admin/provider-verification" className="text-stone-300 hover:text-white">
            Provider Verification
          </Link>
          <Link href="/admin/service-requests" className="text-stone-300 hover:text-white">
            Service Requests
          </Link>
          <Link href="/admin/developments" className="text-stone-300 hover:text-white">Developments</Link>
          <Link href="/admin/admins" className="text-stone-300 hover:text-white">Admins</Link>
          <Link href="/admin/listings" className="text-stone-300 hover:text-white">
            Flagged Listings
          </Link>
          {/* Priority-checklist fix — general account lookup, placed right
              after the two verification links since "find an account" is
              the most common reason an admin would be in this console at
              all, support requests included, not just moderation. */}
          <Link href="/admin/users" className="text-stone-300 hover:text-white">
            Users
          </Link>
          <Link href="/admin/payments" className="text-stone-300 hover:text-white">
            Payments
          </Link>
          <Link href="/admin/reports" className="text-stone-300 hover:text-white">
            Reports
          </Link>
          <Link href="/admin/settings" className="text-stone-300 hover:text-white">
            Settings
          </Link>
          <Link href="/notifications" className="text-stone-300 hover:text-white">
            Notifications
          </Link>
        </nav>
      </div>
      <RouteGuard allowedRoles={["ADMIN", "SUPER_ADMIN"]}>{children}</RouteGuard>
    </div>
  );
}
