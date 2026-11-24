"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, ClipboardList, CreditCard, Headset, Home, MessageSquare, Users } from "lucide-react";

const naira = (value: bigint | number) => `₦${Number(value).toLocaleString()}`;
const tiles = [
  { key: "users", label: "Total accounts", icon: Users },
  { key: "newUsers", label: "New accounts", icon: Users },
  { key: "listings", label: "All listings", icon: Home },
  { key: "inquiries", label: "Property enquiries", icon: MessageSquare },
  { key: "inspections", label: "Inspection requests", icon: ClipboardList },
  { key: "serviceRequests", label: "Service requests", icon: Activity },
] as const;

export default function AdminOperationsPage() {
  const overview = trpc.admin.operationsOverview.useQuery({ days: 30 });
  const data = overview.data;
  const successful = data?.payments.find((p) => p.status === "SUCCESS");
  const pending = data?.payments.find((p) => p.status === "PENDING");
  const failed = data?.payments.find((p) => p.status === "FAILED");
  return <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-stone-500">ULTRA / Operations</p><h1 className="mt-1 text-3xl font-semibold text-stone-900">Admin command centre</h1><p className="mt-2 text-sm text-stone-500">Live operational counts and activity for the last 30 days. Financial figures reflect recorded ledger entries.</p></div>
      <button onClick={() => overview.refetch()} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-white">Refresh data</button>
    </div>
    {overview.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{overview.error.message}</p>}
    {overview.isLoading ? <p className="text-sm text-stone-500">Loading operations data…</p> : data && <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ key, label, icon: Icon }) => <div key={key} className="rounded-xl border border-stone-200 bg-white p-4"><div className="flex items-center justify-between text-stone-500"><span className="text-xs">{label}</span><Icon size={16}/></div><div className="mt-3 text-2xl font-semibold tabular-nums text-stone-900">{data[key].toLocaleString()}</div></div>)}
      </section>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs text-amber-900">Listings awaiting review</div><div className="mt-2 text-2xl font-semibold">{data.pendingListings}</div></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs text-amber-900">Developments awaiting review</div><div className="mt-2 text-2xl font-semibold">{data.developmentsPending}</div></div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4"><div className="text-xs text-red-900">Open listing reports</div><div className="mt-2 text-2xl font-semibold">{data.openReports}</div></div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4"><div className="text-xs text-red-900">Active support tickets</div><div className="mt-2 text-2xl font-semibold">{data.openTickets}</div></div>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5"><h2 className="font-semibold text-stone-900">Payment ledger · 30 days</h2><div className="mt-4 space-y-3">{[{label:"Successful",item:successful},{label:"Pending",item:pending},{label:"Failed",item:failed}].map(({label,item})=><div key={label} className="flex items-center justify-between border-b border-stone-100 pb-2 text-sm"><span className="text-stone-600">{label}</span><span className="font-medium tabular-nums">{item ? `${item.count} · ${naira(item.amountNaira)}` : "0 · ₦0"}</span></div>)}</div><p className="mt-3 text-xs text-stone-500">Totals are transaction amounts, not net revenue or cash settlement balances.</p></div>
        <div className="rounded-xl border border-stone-200 bg-white p-5"><h2 className="font-semibold text-stone-900">Tracked event types</h2>{data.eventTypes.length ? <div className="mt-3 space-y-2">{data.eventTypes.map((event)=><div key={event.type} className="flex justify-between text-sm"><span className="text-stone-600">{event.type.replaceAll("_"," ")}</span><span className="font-medium tabular-nums">{event.count}</span></div>)}</div> : <p className="mt-3 text-sm text-stone-500">No analytics events recorded in this period.</p>}</div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[{title:"Account roles",items:data.breakdowns.userRoles},{title:"Listing lifecycle",items:data.breakdowns.listingStatuses},{title:"Inspection pipeline · 30 days",items:data.breakdowns.inspectionStatuses},{title:"Home Services pipeline · 30 days",items:data.breakdowns.serviceRequestStatuses},{title:"Support ticket status",items:data.breakdowns.ticketStatuses}].map(group=><div key={group.title} className="rounded-xl border border-stone-200 bg-white p-5"><h2 className="text-sm font-semibold text-stone-900">{group.title}</h2><div className="mt-3 space-y-3">{group.items.length?group.items.map(item=><div key={item.label}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="text-stone-600">{item.label.replaceAll("_"," ")}</span><span className="font-medium tabular-nums">{item.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-700" style={{width:`${Math.max(2,Math.min(100,item.count/Math.max(1,...group.items.map(x=>x.count))*100))}%`}}/></div></div>):<p className="text-xs text-stone-500">No records.</p>}</div></div>)}
      </section>
      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5"><div className="mb-3 flex items-center gap-2"><Activity size={17}/><h2 className="font-semibold">Recent admin activity</h2></div>{data.recentAudit.length ? <div className="divide-y divide-stone-100">{data.recentAudit.map((entry)=><div key={entry.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="font-medium text-stone-800">{entry.action} <span className="font-normal text-stone-500">· {entry.targetType} / {entry.targetId}</span></span><span className="text-stone-500">{new Date(entry.createdAt).toLocaleString()}</span></div>)}</div> : <p className="text-sm text-stone-500">No recorded admin actions yet.</p>}</section>
    </>}
    <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">Operational workspaces</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{href:"/admin/support",title:"Support desk",desc:"Assign, prioritise and resolve customer cases",icon:Headset},{href:"/admin/reports",title:"Listing reports",desc:"Review fraud, accuracy and safety reports",icon:AlertTriangle},{href:"/admin/payments",title:"Payments",desc:"Review ledger entries and financial corrections",icon:CreditCard},{href:"/admin/users",title:"Account lookup",desc:"Find buyer, realtor and provider accounts",icon:Users}].map(({href,title,desc,icon:Icon})=><Link href={href} key={href} className="rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-400"><Icon size={18} className="text-stone-500"/><div className="mt-3 text-sm font-semibold">{title}</div><p className="mt-1 text-xs text-stone-500">{desc}</p></Link>)}</div></section>
  </main>;
}
