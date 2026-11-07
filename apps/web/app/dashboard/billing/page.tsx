"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Wallet, ArrowUpRight } from "lucide-react";
import { billingStateLabel } from "@ultra/db";

function formatNaira(n: bigint | number) {
  const num = Number(n);
  return `\u20a6${num.toLocaleString()}`;
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
};

const TYPE_LABELS: Record<string, string> = {
  TOPUP: "Balance top-up",
  LEAD_FEE: "Lead fee",
  SUBSCRIPTION: "Subscription",
  REFUND: "Refund",
};

export default function BillingPage() {
  const { data: balance, isLoading: loadingBalance, error: balanceError } = trpc.payments.balance.useQuery();
  const { data: transactions, isLoading: loadingTx } = trpc.payments.myTransactions.useQuery();
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const initiate = trpc.payments.initiateTopUp.useMutation({
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
  });

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Billing</h1>
      <p className="text-sm text-stone-500 mb-8">Your prepaid balance covers per-lead fees automatically — no charge to buyers, ever.</p>

      {balanceError && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          {balanceError.message.includes("Verified") ? "Requires a verified realtor account." : balanceError.message}
        </div>
      )}

      {!balanceError && (
        <div className="flex items-center gap-4 border border-stone-200 rounded-xl p-5 mb-6">
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Wallet size={18} className="text-emerald-800" />
          </div>
          <div>
            <div className="text-xs text-stone-500">Current balance</div>
            <div className="text-2xl font-semibold text-stone-900">
              {loadingBalance ? "\u2026" : formatNaira(balance?.creditBalanceNaira ?? 0)}
            </div>
          </div>
        </div>
      )}

      {!balanceError && (
        <div className="border border-stone-200 rounded-xl p-5 mb-8">
          <div className="text-sm font-semibold text-stone-900 mb-3">Top up</div>
          <div className="flex gap-3 mb-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (min \u20a6500)"
              className="flex-1 border border-stone-300 rounded-lg px-3 py-2.5 text-sm outline-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 border border-stone-300 rounded-lg px-3 py-2.5 text-sm outline-none"
            />
          </div>
          <button
            disabled={initiate.isPending || !amount || Number(amount) < 500 || !email}
            onClick={() => initiate.mutate({ amountNaira: Number(amount), email })}
            className="w-full bg-emerald-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {initiate.isPending ? "Redirecting\u2026" : "Top up with Paystack"}
            {!initiate.isPending && <ArrowUpRight size={14} />}
          </button>
          {initiate.error && <p className="text-xs text-red-700 mt-2">{initiate.error.message}</p>}
        </div>
      )}

      {!balanceError && (
        <div>
          <div className="text-sm font-semibold text-stone-900 mb-3">Transaction history</div>
          {loadingTx && <div className="text-sm text-stone-500">Loading\u2026</div>}
          {transactions?.length === 0 && <div className="text-sm text-stone-500">No transactions yet.</div>}
          <div className="space-y-2">
            {transactions?.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border border-stone-200 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm text-stone-900">{TYPE_LABELS[tx.type] ?? tx.type}</div>
                  <div className="text-xs text-stone-400 font-mono">{new Date(tx.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-stone-700">
                    {tx.type === "TOPUP" ? "+" : "-"}{formatNaira(tx.amountNaira)}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${STATUS_STYLES[tx.status]}`}>
                    {billingStateLabel(tx.type, tx.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
