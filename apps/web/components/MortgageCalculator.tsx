"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
// Deep import on purpose: the pure calculator, not the package index (which constructs a PrismaClient).
import { calculateMonthlyMortgage, ILLUSTRATIVE_RATE_PCT, MORTGAGE_LIMITS } from "@ultra/db/src/mortgage";

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function MortgageCalculator() {
  const params = useSearchParams();
  const initialPrice = Number(params.get("price")) > 0 ? Number(params.get("price")) : 100_000_000;
  const [price, setPrice] = useState(initialPrice);
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(ILLUSTRATIVE_RATE_PCT);

  const r = useMemo(() => calculateMonthlyMortgage(price, down, years, rate), [price, down, years, rate]);

  const slider = (label: string, value: number, set: (n: number) => void, [min, max]: readonly [number, number], suffix: string, step = 1) => (
    <label className="block">
      <div className="flex justify-between text-xs font-semibold text-stone-700 mb-1.5">
        <span>{label}</span>
        <span className="text-emerald-800">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full accent-emerald-800" />
    </label>
  );

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <div className="text-xs tracking-widest text-stone-500 font-mono mb-1">MORTGAGE</div>
      <h1 className="text-3xl font-semibold text-stone-900 mb-2">Estimate your monthly repayment</h1>
      <p className="text-sm text-stone-500 mb-8">A planning tool. ULTRA is not a lender or broker — use the rate your bank actually quotes you.</p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col gap-5">
          <label className="block">
            <div className="text-xs font-semibold text-stone-700 mb-1.5">Property price (₦)</div>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-800" />
          </label>
          {slider("Down payment", down, setDown, MORTGAGE_LIMITS.downPaymentPct, "%")}
          {slider("Loan term", years, setYears, MORTGAGE_LIMITS.tenureYears, " yrs")}
          {slider("Interest rate (per year)", rate, setRate, [1, 40], "%", 0.5)}
          <p className="text-[11px] text-stone-500">The starting rate ({ILLUSTRATIVE_RATE_PCT}%) is an example. Use the rate your bank quotes.</p>
        </div>

        <div className="bg-emerald-900 text-white rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <div className="text-xs text-white/60">Estimated monthly repayment</div>
            <div className="text-3xl font-semibold">{naira(r.monthlyRepaymentNgn)}</div>
          </div>
          <dl className="text-sm grid grid-cols-2 gap-y-3">
            <dt className="text-white/60">Down payment</dt><dd className="text-right">{naira(r.downPaymentNgn)}</dd>
            <dt className="text-white/60">Loan amount</dt><dd className="text-right">{naira(r.loanPrincipalNgn)}</dd>
            <dt className="text-white/60">Total interest</dt><dd className="text-right">{naira(r.totalInterestNgn)}</dd>
            <dt className="text-white/60">Total repaid</dt><dd className="text-right">{naira(r.totalRepaymentNgn)}</dd>
          </dl>
          <p className="text-[11px] text-white/50 mt-auto">Excludes legal, valuation, insurance and management fees. Not an offer or approval.</p>
        </div>
      </div>

      <div className="mt-8 text-sm">
        <Link href="/buy" className="text-emerald-800 font-medium">Browse homes for sale →</Link>
      </div>
    </main>
  );
}
