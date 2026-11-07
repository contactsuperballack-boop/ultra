"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Check } from "lucide-react";

export default function PlatformSettingsPage() {
  const { data: config, isLoading, refetch } = trpc.payments.platformConfig.useQuery();
  const update = trpc.payments.adminUpdatePlatformConfig.useMutation({ onSuccess: () => refetch() });

  const [leadFeeNaira, setLeadFeeNaira] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  // Priority-checklist fix: these two were previously hardcoded constants
  // (SUBSCRIPTION_PRICE_NAIRA / PROVIDER_SUBSCRIPTION_PRICE_NAIRA) with no
  // admin UI at all — same page, same pattern as the two fields above,
  // since an operator shouldn't need to know two different places exist
  // for "change a platform price."
  const [realtorSubPrice, setRealtorSubPrice] = useState("");
  const [providerSubPrice, setProviderSubPrice] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setLeadFeeNaira(String(config.leadFeeNaira));
      setCommissionPercent(String(config.commissionRateBps / 100));
      setRealtorSubPrice(String(config.realtorSubscriptionPriceNaira));
      setProviderSubPrice(String(config.providerSubscriptionPriceNaira));
    }
  }, [config]);

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Platform pricing</h1>
      <p className="text-sm text-stone-500 mb-8">
        These figures were previously hardcoded constants in the source — placeholder values, not confirmed business
        decisions. Now genuinely editable without a redeploy.
      </p>

      {isLoading && <div className="text-sm text-stone-500">Loading…</div>}

      {config && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Per-inquiry lead fee (\u20a6)</label>
            <input
              type="number"
              value={leadFeeNaira}
              onChange={(e) => {
                setLeadFeeNaira(e.target.value);
                setSaved(false);
              }}
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <p className="text-[11px] text-stone-400 mt-1">Charged to a realtor's balance when a buyer sends a new inquiry (Phase 1).</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Provider commission rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={commissionPercent}
              onChange={(e) => {
                setCommissionPercent(e.target.value);
                setSaved(false);
              }}
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <p className="text-[11px] text-stone-400 mt-1">Accrued to a provider's balance when a job is marked complete (Phase 2).</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Realtor subscription price (\u20a6)</label>
            <input
              type="number"
              value={realtorSubPrice}
              onChange={(e) => {
                setRealtorSubPrice(e.target.value);
                setSaved(false);
              }}
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <p className="text-[11px] text-stone-400 mt-1">30-day premium placement subscription (Phase 1). Was hardcoded; now here.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Provider subscription price (\u20a6)</label>
            <input
              type="number"
              value={providerSubPrice}
              onChange={(e) => {
                setProviderSubPrice(e.target.value);
                setSaved(false);
              }}
              className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <p className="text-[11px] text-stone-400 mt-1">30-day search-ranking subscription (Phase 2). Was hardcoded; now here.</p>
          </div>

          {config.updatedByAdminId && (
            <p className="text-[11px] text-stone-400">Last changed {new Date(config.updatedAt).toLocaleString()}</p>
          )}

          <button
            onClick={() =>
              update.mutate(
                {
                  leadFeeNaira: Number(leadFeeNaira),
                  commissionRateBps: Math.round(Number(commissionPercent) * 100),
                  realtorSubscriptionPriceNaira: Number(realtorSubPrice),
                  providerSubscriptionPriceNaira: Number(providerSubPrice),
                },
                { onSuccess: () => setSaved(true) }
              )
            }
            disabled={update.isPending}
            className="w-full bg-stone-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {update.isPending && <Loader2 size={15} className="animate-spin" />}
            {saved && !update.isPending ? (
              <>
                <Check size={15} /> Saved
              </>
            ) : update.isPending ? (
              "Saving…"
            ) : (
              "Save changes"
            )}
          </button>
          {update.error && <p className="text-xs text-red-700">{update.error.message}</p>}
        </div>
      )}
    </main>
  );
}
