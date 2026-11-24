"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Search } from "lucide-react";

function formatNaira(n: bigint | number) {
  return `\u20a6${Number(n).toLocaleString()}`;
}

export default function AdminPaymentsPage() {
  const [side, setSide] = useState<"realtor" | "provider">("realtor");
  const [action, setAction] = useState<"refund" | "adjustment">("refund");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const ledger = trpc.payments.adminTransactionHistory.useQuery({ limit: 50 });

  const realtorResults = trpc.realtors.adminSearch.useQuery({ query }, { enabled: side === "realtor" && query.length >= 2 });
  const providerResults = trpc.providers.adminSearch.useQuery({ query }, { enabled: side === "provider" && query.length >= 2 });
  const results = side === "realtor" ? realtorResults.data : providerResults.data;

  const refundRealtor = trpc.payments.adminIssueRefund.useMutation({
    onSuccess: (r) => setResult(`Applied ${formatNaira(r.appliedAmountNaira)} of ${formatNaira(r.requestedAmountNaira)} requested.`),
  });
  const refundProvider = trpc.payments.adminIssueProviderRefund.useMutation({
    onSuccess: (r) => setResult(`Applied ${formatNaira(r.appliedAmountNaira)} of ${formatNaira(r.requestedAmountNaira)} requested.`),
  });
  const adjust = trpc.payments.adminManualAdjustment.useMutation({
    onSuccess: (r) => setResult(`Applied a ${direction} of ${formatNaira(r.appliedAmountNaira)}.`),
  });

  const pending = refundRealtor.isPending || refundProvider.isPending || adjust.isPending;
  const error = refundRealtor.error || refundProvider.error || adjust.error;

  function submit() {
    setResult(null);
    if (!selectedId || !amount || !note) return;
    if (action === "refund") {
      if (side === "realtor") refundRealtor.mutate({ realtorProfileId: selectedId, amountNaira: Number(amount), note });
      else refundProvider.mutate({ providerProfileId: selectedId, amountNaira: Number(amount), note });
    } else {
      adjust.mutate({
        ...(side === "realtor" ? { realtorProfileId: selectedId } : { providerProfileId: selectedId }),
        direction,
        amountNaira: Number(amount),
        note,
      });
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Payment corrections</h1>
      <p className="text-sm text-stone-500 mb-6">
        Refunds and manual adjustments against a realtor's lead-fee balance or a provider's outstanding commission. Every
        correction is recorded as its own ledger entry — nothing here edits history in place.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => {
            setSide("realtor");
            setSelectedId(null);
            setResult(null);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border ${side === "realtor" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600"}`}
        >
          Realtor
        </button>
        <button
          onClick={() => {
            setSide("provider");
            setSelectedId(null);
            setResult(null);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border ${side === "provider" ? "bg-teal-800 text-white border-teal-800" : "border-stone-300 text-stone-600"}`}
        >
          Provider
        </button>
        <div className="w-px bg-stone-200 mx-1" />
        <button
          onClick={() => setAction("refund")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border ${action === "refund" ? "bg-amber-100 border-amber-300 text-amber-900" : "border-stone-300 text-stone-600"}`}
        >
          Refund
        </button>
        <button
          onClick={() => setAction("adjustment")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border ${action === "adjustment" ? "bg-amber-100 border-amber-300 text-amber-900" : "border-stone-300 text-stone-600"}`}
        >
          Manual adjustment
        </button>
      </div>

      {action === "adjustment" && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setDirection("credit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${direction === "credit" ? "bg-emerald-100 border-emerald-300 text-emerald-900" : "border-stone-300 text-stone-600"}`}
          >
            Credit {side === "realtor" ? "(increase balance)" : "(reduce what's owed)"}
          </button>
          <button
            onClick={() => setDirection("debit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${direction === "debit" ? "bg-red-100 border-red-300 text-red-900" : "border-stone-300 text-stone-600"}`}
          >
            Debit {side === "realtor" ? "(decrease balance)" : "(increase what's owed)"}
          </button>
        </div>
      )}

      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-3 text-stone-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          placeholder={side === "realtor" ? "Search by agency name or phone…" : "Search by business name or phone…"}
          className="w-full border border-stone-300 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none"
        />
      </div>

      {results && results.length > 0 && !selectedId && (
        <div className="border border-stone-200 rounded-xl divide-y divide-stone-100 mb-4">
          {results.map((r: any) => (
            <button key={r.id} onClick={() => setSelectedId(r.id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50">
              <div className="font-medium text-stone-900">{r.businessName ?? r.agencyName}</div>
              <div className="text-xs text-stone-500">
                {r.user.name} · {r.user.phone}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="border border-stone-200 rounded-xl p-5 mb-4">
          <div className="text-xs text-stone-500 mb-3">
            Selected account: <span className="font-mono text-stone-700">{selectedId}</span>{" "}
            <button onClick={() => setSelectedId(null)} className="text-teal-800 underline ml-1">
              change
            </button>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (\u20a6)"
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm outline-none mb-3"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (required — goes on the ledger entry)"
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm outline-none mb-3"
          />
          <button
            onClick={submit}
            disabled={pending || !amount || !note}
            className="w-full bg-stone-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {pending ? "Applying…" : action === "refund" ? "Apply refund" : `Apply ${direction}`}
          </button>
          {error && <p className="text-xs text-red-700 mt-2">{error.message}</p>}
          {result && <p className="text-xs text-emerald-700 mt-2">{result}</p>}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-stone-900 mb-1">Recent transaction ledger</h2>
        <p className="text-xs text-stone-500 mb-3">Latest 50 entries across realtor and provider accounts. Use this view to reconcile pending, successful and failed payment references.</p>
        {ledger.isLoading && <p className="text-sm text-stone-500">Loading ledger…</p>}
        {ledger.error && <p className="text-sm text-red-700">{ledger.error.message}</p>}
        <div className="space-y-2">
          {ledger.data?.items.map((tx) => (
            <article key={tx.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">{tx.realtorProfile?.agencyName ?? tx.providerProfile?.businessName ?? "Unassigned account"}</p>
                  <p className="text-xs text-stone-500">{tx.type} · {tx.provider} · {new Date(tx.createdAt).toLocaleString()}</p>
                  <p className="mt-1 break-all font-mono text-[10px] text-stone-500">{tx.providerRef}</p>
                  {tx.note && <p className="mt-1 text-xs text-stone-600">{tx.note}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-stone-900">{formatNaira(tx.amountNaira)}</p>
                  <p className={`mt-1 text-[10px] font-semibold ${tx.status === "SUCCESS" ? "text-emerald-700" : tx.status === "FAILED" ? "text-red-700" : "text-amber-700"}`}>{tx.status}</p>
                </div>
              </div>
            </article>
          ))}
          {ledger.data?.items.length === 0 && <p className="text-sm text-stone-500">No transactions recorded yet.</p>}
        </div>
      </section>

      <p className="text-xs text-stone-500">
        Refund amounts are capped automatically at what's actually outstanding. Manual credits/debits are explicit about
        direction rather than inferred from a sign, so a typo can't silently flip a credit into a debit.
      </p>
    </main>
  );
}
