"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { session } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("+234");
  const [code, setCode] = useState("");

  const requestOtp = trpc.auth.requestOtp.useMutation({ onSuccess: () => setStep("code") });
  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: (data) => {
      session.set(data.accessToken, data.refreshToken);
      router.push("/dashboard/listings");
    },
  });

  return (
    <main className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Sign in to ULTRA</h1>
      <p className="text-sm text-stone-500 mb-8">
        {step === "phone" ? "We'll text you a verification code." : `Enter the code sent to ${phone}.`}
      </p>

      {step === "phone" ? (
        <div className="space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+2348012345678"
            className="w-full border border-stone-300 rounded-xl px-4 py-3 text-sm outline-none"
          />
          <button
            disabled={requestOtp.isPending}
            onClick={() => requestOtp.mutate({ phone })}
            className="w-full bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {requestOtp.isPending ? "Sending\u2026" : "Send code"}
          </button>
          {requestOtp.error && <p className="text-xs text-red-700">{requestOtp.error.message}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
            className="w-full border border-stone-300 rounded-xl px-4 py-3 text-sm outline-none tracking-widest text-center font-mono text-lg"
          />
          <button
            disabled={verifyOtp.isPending || code.length !== 6}
            onClick={() => verifyOtp.mutate({ phone, code })}
            className="w-full bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {verifyOtp.isPending ? "Verifying\u2026" : "Verify & sign in"}
          </button>
          {verifyOtp.error && <p className="text-xs text-red-700">{verifyOtp.error.message}</p>}
          <button onClick={() => setStep("phone")} className="w-full text-xs text-stone-500 mt-2">
            Use a different number
          </button>
        </div>
      )}

      <p className="text-[11px] text-stone-400 mt-8">
        In development, the code is logged to the API server console (no TERMII_API_KEY configured) rather than sent as a real SMS.
      </p>
    </main>
  );
}
