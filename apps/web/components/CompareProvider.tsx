"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";

const STORAGE_KEY = "ultra:property-compare:v1";
const MAX_COMPARE = 4;

type CompareContextValue = {
  ids: string[];
  toggle: (id: string) => void;
  clear: () => void;
  canAdd: (id: string) => boolean;
};

const CompareContext = createContext<CompareContextValue | null>(null);

export function useCompare() {
  const value = useContext(CompareContext);
  if (!value) throw new Error("useCompare must be used inside CompareProvider.");
  return value;
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(stored)) setIds([...new Set(stored.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 128))].slice(0, MAX_COMPARE));
    } catch {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* storage can be disabled by the browser */ }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* comparison remains usable for this session */ }
    }
  }, [ids, hydrated]);

  const value = useMemo<CompareContextValue>(() => ({
    ids,
    toggle: (id) => setIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < MAX_COMPARE ? [...current, id] : current),
    clear: () => setIds([]),
    canAdd: (id) => ids.includes(id) || ids.length < MAX_COMPARE,
  }), [ids]);

  return (
    <CompareContext.Provider value={value}>
      {children}
      {ids.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl rounded-2xl bg-stone-950 text-white shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ArrowLeftRight size={18} className="text-emerald-300 shrink-0" />
            <div className="min-w-0"><div className="text-sm font-semibold">Compare properties</div><div className="text-[11px] text-stone-300">{ids.length} of {MAX_COMPARE} selected · choose at least 2</div></div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setIds([])} aria-label="Clear comparison" className="p-2 rounded-lg text-stone-300 hover:bg-white/10"><X size={16} /></button>
            {ids.length >= 2 ? (
              <Link href="/compare" className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 px-4 py-2 text-xs font-semibold">Compare</Link>
            ) : (
              <span aria-disabled="true" className="rounded-lg bg-stone-700 text-stone-400 px-4 py-2 text-xs font-semibold">Compare</span>
            )}
          </div>
        </div>
      )}
    </CompareContext.Provider>
  );
}
