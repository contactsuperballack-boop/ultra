"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Check, Sparkles, MapPin, Wrench, House, ShieldCheck } from "lucide-react";

const SPECIALTY_LABELS: Record<string, string> = {
  PAINTING: "Painting", PLUMBING: "Plumbing", FUMIGATION: "Fumigation", ELECTRICAL: "Electrical",
  SOLAR: "Solar installations", CCTV: "CCTV installations", SECURITY_SYSTEMS: "Security systems",
  FURNITURE: "Furniture", CLEANING: "Cleaning", MOVE_IN: "Move-In", PEST_CONTROL: "Pest control",
};

const DEPARTMENTS = [
  { value: "SMART_HOME_INSTALLATIONS", label: "Smart Home Installations", description: "Solar installations, CCTV installations and security systems.", examples: "Solar · CCTV · Security systems", icon: House },
  { value: "LUXURY", label: "Luxury", description: "Painting and furniture services for refined spaces.", examples: "Painting · Furniture", icon: Sparkles },
  { value: "ELECTRICAL_PLUMBING", label: "Electrical & Plumbing", description: "Essential electrical and plumbing work for homes and properties.", examples: "Electrical · Plumbing", icon: Wrench },
  { value: "CLEANING_MOVE_IN", label: "Cleaning & Move-In", description: "Cleaning and move-in support for homes and properties.", examples: "Cleaning · Move-In", icon: House },
  { value: "FUMIGATION_PEST_CONTROL", label: "Fumigation & Pest Control", description: "Fumigation and pest-control services.", examples: "Fumigation · Pest control", icon: ShieldCheck },
] as const;

function VerifiedSeal() {
  return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white flex-shrink-0" title="ULTRA provider verification"><Check size={10} strokeWidth={3} /></span>;
}

export default function ServicesSearchPage() {
  const [department, setDepartment] = useState<(typeof DEPARTMENTS)[number]["value"] | undefined>(undefined);
  const { data, isLoading, error } = trpc.providers.search.useQuery({ department, limit: 20 });

  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
      <section className="rounded-3xl bg-teal-950 text-white p-7 sm:p-10 mb-10">
        <div className="text-xs tracking-[0.2em] text-teal-200 font-mono mb-3">ULTRA HOME SERVICES · ABUJA</div>
        <h1 className="text-3xl sm:text-4xl font-semibold max-w-2xl leading-tight">Find trusted specialists for the systems, finishes and services your property needs.</h1>
        <p className="text-sm sm:text-base text-teal-100 mt-4 max-w-2xl leading-relaxed">Discover service providers, review their offerings and send a request directly through ULTRA. Provider verification is limited to the checks shown on each profile.</p>
        <Link href="/partner/verification" className="inline-flex mt-6 rounded-xl bg-white text-teal-950 px-5 py-3 text-sm font-semibold hover:bg-teal-50">Become a service partner</Link>
      </section>

      <div className="flex items-end justify-between gap-4 mb-5">
        <div><div className="text-xs tracking-widest text-stone-500 font-mono mb-1">EXPLORE SERVICES</div><h2 className="text-2xl font-semibold text-stone-900">What does your property need?</h2></div>
        <button onClick={() => setDepartment(undefined)} className={`text-xs font-semibold underline ${!department ? "text-teal-800" : "text-stone-500"}`}>View all</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {DEPARTMENTS.map((d) => {
          const Icon = d.icon;
          const active = department === d.value;
          return <button key={d.value} onClick={() => setDepartment(active ? undefined : d.value)} className={`text-left border rounded-2xl p-5 transition-colors ${active ? "border-teal-800 bg-teal-50 ring-1 ring-teal-800" : "border-stone-200 bg-white hover:border-teal-400"}`}>
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-900 flex items-center justify-center mb-4"><Icon size={19}/></div>
            <h3 className="font-semibold text-stone-900">{d.label}</h3>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">{d.description}</p>
            <p className="text-xs text-stone-500 mt-3">{d.examples}</p>
          </button>;
        })}
      </div>

      <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-semibold text-stone-900">{department ? DEPARTMENTS.find((d) => d.value === department)?.label : "Available service providers"}</h2><span className="text-xs text-stone-500">Abuja, Nigeria</span></div>
      {isLoading && <div className="text-stone-500 text-sm py-8">Loading providers…</div>}
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">Couldn't load providers: {error.message}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.items.map((provider) => {
          const isPremium = provider.subscriptionTier === "PREMIUM" && provider.subscriptionExpiresAt && new Date(provider.subscriptionExpiresAt) > new Date();
          return <Link key={provider.id} href={`/services/${provider.id}`} className="block border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow p-5">
            <div className="flex items-center justify-between mb-3"><div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-semibold text-sm">{provider.businessName.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>{isPremium && <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200"><Sparkles size={10}/> PREMIUM</span>}</div>
            <div className="text-sm font-semibold text-stone-900 flex items-center gap-1">{provider.businessName}<VerifiedSeal/></div>
            <div className="text-xs text-stone-500 mt-2">{[...new Set(provider.offerings.map((o: any) => o.category))].map((v: string) => SPECIALTY_LABELS[v] ?? v).join(" · ")}</div>
            <div className="flex items-center gap-1 text-xs text-stone-500 mt-3 font-mono"><MapPin size={11} className="text-emerald-800"/>{provider.serviceArea}</div>
          </Link>;
        })}
      </div>
      {data && data.items.length === 0 && <div className="text-center text-stone-500 text-sm mt-10 border border-dashed border-stone-300 rounded-2xl p-10">No providers are listed in this department yet. Check back as the Abuja pilot cohort is onboarded.</div>}

      <section className="mt-14 border-t border-stone-200 pt-8 grid sm:grid-cols-3 gap-6">
        {[{n:"01",t:"Choose a service",d:"Browse a department and compare provider offerings."},{n:"02",t:"Send a request",d:"Describe the work and share your preferred timing."},{n:"03",t:"Coordinate in ULTRA",d:"Track the request and communicate through your account."}].map((x) => <div key={x.n}><div className="text-xs font-mono text-teal-800 mb-2">{x.n}</div><h3 className="font-semibold text-stone-900">{x.t}</h3><p className="text-sm text-stone-600 mt-1">{x.d}</p></div>)}
      </section>
    </main>
  );
}
