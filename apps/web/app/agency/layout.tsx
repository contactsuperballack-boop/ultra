import Link from "next/link";
import { RouteGuard } from "@/components/RouteGuard";

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-stone-50"><header className="border-b border-stone-200 bg-slate-900 px-5 py-3 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-5"><span className="text-sm font-semibold tracking-wide">ULTRA AGENCY</span><nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-200"><Link href="/agency/dashboard" className="hover:text-white">Overview</Link><Link href="/dashboard/listings" className="hover:text-white">Listings</Link><Link href="/dashboard/developments" className="hover:text-white">Developments</Link><Link href="/dashboard/inquiries" className="hover:text-white">Enquiries</Link><Link href="/dashboard/billing" className="hover:text-white">Billing</Link></nav></div><Link href="/notifications" className="text-sm text-slate-200 hover:text-white">Notifications</Link></div></header><RouteGuard>{children}</RouteGuard></div>;
}
