"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

const TARGETS = [
  { value: "/search", label: "All" },
  { value: "/buy", label: "Buy" },
  { value: "/to-let", label: "To Let" },
  { value: "/land", label: "Land" },
];

export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState("/search");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `${target}?query=${encodeURIComponent(q.trim())}` : target);
      }}
      className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-lg max-w-2xl"
    >
      <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Search in" className="sm:w-28 rounded-xl px-3 py-3 text-sm text-stone-700 bg-stone-50 outline-none">
        {TARGETS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <div className="flex-1 relative">
        <Search size={16} className="absolute left-3 top-3.5 text-stone-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by location, estate, or keyword" className="w-full pl-9 pr-3 py-3 text-sm outline-none rounded-xl text-stone-900" />
      </div>
      <button type="submit" className="bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl px-6 py-3">Search</button>
    </form>
  );
}
