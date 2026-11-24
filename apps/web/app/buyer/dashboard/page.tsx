"use client";

import Link from "next/link";
import type { ElementType } from "react";
import { trpc } from "@/lib/trpc";
import { RouteGuard } from "@/components/RouteGuard";
import { Bookmark, CalendarDays, ClipboardList, Heart, MessageCircle, Bell, Wrench, ArrowUpRight } from "lucide-react";

function Stat({ label, value, icon: Icon, href }: { label: string; value: number | null; icon: ElementType; href: string }) {
  return <Link href={href} className="rounded-2xl border border-stone-200 bg-white p-4 hover:border-emerald-300 transition-colors"><div className="flex items-center justify-between"><span className="text-xs text-stone-500">{label}</span><Icon size={17} className="text-emerald-800" /></div><div className="mt-3 text-2xl font-semibold text-stone-900">{value ?? "—"}</div><span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-800">Open <ArrowUpRight size={12}/></span></Link>;
}

function BuyerDashboardContent() {
  const { data, isLoading, error } = trpc.dashboards.buyerOverview.useQuery();
  if (isLoading) return <main className="mx-auto max-w-6xl px-5 py-10 text-sm text-stone-500">Loading your dashboard…</main>;
  if (error) return <main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-xl font-semibold">Your dashboard</h1><p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error.message}</p></main>;
  if (!data) return null;
  const money = (value: bigint | number) => `₦${Number(value).toLocaleString("en-NG")}`;
  return <main className="mx-auto max-w-6xl px-5 py-9">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">My ULTRA</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Your property dashboard</h1><p className="mt-2 text-sm text-stone-500">Keep track of properties, conversations and inspections in one place.</p></div><Link href="/search" className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white">Discover properties</Link></div>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Stat label="Saved properties" value={data.counts.savedProperties} icon={Heart} href="/saved-properties" />
      <Stat label="Saved searches" value={data.counts.savedSearches} icon={Bookmark} href="/saved-searches" />
      <Stat label="Enquiries" value={data.counts.inquiries} icon={MessageCircle} href="/messages" />
      <Stat label="Inspections" value={data.counts.inspections} icon={CalendarDays} href="/my-inspections" />
      <Stat label="Unread alerts" value={data.counts.unreadNotifications} icon={Bell} href="/notifications" />
      <Stat label="Service requests" value={data.counts.serviceRequests} icon={Wrench} href="/bookings" />
    </section>
    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-stone-900">Saved properties</h2><Link href="/saved-properties" className="text-xs font-semibold text-emerald-800">View all</Link></div>
        {data.recentSaved.length ? <div className="mt-4 divide-y divide-stone-100">{data.recentSaved.map((item) => <Link key={item.id} href={`/listings/${item.id}`} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-stone-900">{item.title}</p><p className="mt-1 text-xs text-stone-500">{item.area}, {item.city}</p></div><span className="shrink-0 text-sm font-semibold text-stone-800">{money(item.priceNaira)}</span></Link>)}</div> : <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Properties you save will appear here.</p>}
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-stone-900">Recent enquiries</h2><Link href="/messages" className="text-xs font-semibold text-emerald-800">Open messages</Link></div>
        {data.recentInquiries.length ? <div className="mt-4 divide-y divide-stone-100">{data.recentInquiries.map((item) => <Link key={item.id} href="/messages" className="block py-3"><p className="text-sm font-medium text-stone-900">{item.listing.title}</p><p className="mt-1 text-xs text-stone-500">{item.listing.area} · {item.listing.status.replaceAll("_", " ")}</p><p className="mt-2 truncate text-xs text-stone-600">{item.messages[0]?.body ?? "No messages yet"}</p></Link>)}</div> : <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Your property conversations will appear here.</p>}
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2"><div className="flex items-center justify-between"><h2 className="font-semibold text-stone-900">Inspection activity</h2><Link href="/my-inspections" className="text-xs font-semibold text-emerald-800">Manage inspections</Link></div>
        {data.recentInspections.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{data.recentInspections.map((item) => <div key={item.id} className="rounded-xl bg-stone-50 p-4"><div className="flex justify-between gap-3"><p className="text-sm font-medium text-stone-900">{item.listing.title}</p><span className="text-[10px] font-semibold uppercase text-emerald-800">{item.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-stone-500">{item.kind.replaceAll("_", " ")} · {item.listing.area}</p><p className="mt-2 text-xs text-stone-600">Preferred: {new Date(item.preferredDate).toLocaleDateString("en-NG")}</p>{item.scheduledDate && <p className="text-xs text-emerald-800">Confirmed: {new Date(item.scheduledDate).toLocaleDateString("en-NG")}</p>}</div>)}</div> : <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Inspection requests and their status will appear here.</p>}
      </div>
    </section>
    <div className="mt-6 flex flex-wrap gap-3 text-sm"><Link href="/services" className="inline-flex items-center gap-2 font-medium text-emerald-800"><Wrench size={15}/> Find a home service</Link><Link href="/account" className="inline-flex items-center gap-2 font-medium text-stone-600"><ClipboardList size={15}/> Account settings</Link></div>
  </main>;
}

export default function BuyerDashboardPage() { return <RouteGuard><BuyerDashboardContent /></RouteGuard>; }
