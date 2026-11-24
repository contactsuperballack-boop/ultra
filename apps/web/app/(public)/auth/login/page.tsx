"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { session } from "@/lib/session";
import { PHASE2_ENABLED } from "@/lib/featureFlags";
// Deep imports: pure helpers, no Prisma in the browser bundle.
import { formatNigerianPhone, normalizeNigerianPhone } from "@ultra/db/src/phone";
import { landingFor, safeNextPath } from "@ultra/db/src/redirect";

const RESEND_SECONDS = 60; // matches the server's per-phone cooldown

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState(""); // normalised +234XXXXXXXXXX once accepted
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const submittedCode = useRef<string | null>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
      setStep("code");
      setCooldown(RESEND_SECONDS);
    },
  });
  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: (data) => {
      session.set(data.accessToken, data.refreshToken);
      // Back to where they were going (e.g. the listing they wanted to message); otherwise somewhere that suits their role.
      router.push(next ? safeNextPath(next, landingFor(data.user.role, { phase2Enabled: PHASE2_ENABLED })) : landingFor(data.user.role, { phase2Enabled: PHASE2_ENABLED }));
    },
    onError: () => {
      submittedCode.current = null; // allow another attempt after a wrong code
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Submit as soon as the sixth digit is in (also what an SMS autofill triggers).
  useEffect(() => {
    if (step === "code" && code.length === 6 && !verifyOtp.isPending && submittedCode.current !== code) {
      submittedCode.current = code;
      verifyOtp.mutate({ phone, code });
    }
  }, [code, step, phone, verifyOtp]);

  const sendCode = () => {
    const normalised = normalizeNigerianPhone(phoneInput);
    if (!normalised) {
      setLocalError("Enter a valid Nigerian mobile number, for example 0803 123 4567.");
      return;
    }
    setLocalError(null);
    setPhone(normalised);
    requestOtp.mutate({ phone: normalised });
  };

  const resend = () => {
    setCode("");
    submittedCode.current = null;
    verifyOtp.reset();
    requestOtp.mutate({ phone }, { onSuccess: () => setCooldown(RESEND_SECONDS) });
  };

  const inputCls = "w-full border border-stone-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-800";

  return (
    <main className="max-w-sm mx-auto px-6 py-20">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Sign in to ULTRA</h1>
      <p className="text-sm text-stone-500 mb-8">
        {step === "phone" ? "We'll text you a verification code." : `Enter the code sent to ${formatNigerianPhone(phone)}.`}
      </p>

      {step === "phone" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <label htmlFor="phone" className="block text-xs font-semibold text-stone-700">Mobile number</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="0803 123 4567"
            className={inputCls}
          />
          <p className="text-[11px] text-stone-500">Nigerian mobile numbers only. Any format works: 0803…, +234 803… or 803….</p>
          <button type="submit" disabled={requestOtp.isPending || !phoneInput.trim()} className="w-full bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
            {requestOtp.isPending ? "Sending…" : "Send code"}
          </button>
          {(localError || requestOtp.error) && (
            <p role="alert" className="text-xs text-red-700">{localError ?? requestOtp.error!.message}</p>
          )}
        </form>
      ) : (
        <div className="space-y-3">
          <label htmlFor="code" className="block text-xs font-semibold text-stone-700">6-digit code</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className={`${inputCls} text-center tracking-[0.5em] text-lg`}
          />
          <button
            onClick={() => {
              submittedCode.current = code;
              verifyOtp.mutate({ phone, code });
            }}
            disabled={verifyOtp.isPending || code.length !== 6}
            className="w-full bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {verifyOtp.isPending ? "Verifying…" : "Verify & sign in"}
          </button>
          {verifyOtp.error && <p role="alert" className="text-xs text-red-700">{verifyOtp.error.message}</p>}
          {requestOtp.error && <p role="alert" className="text-xs text-red-700">{requestOtp.error.message}</p>}

          <div className="flex items-center justify-between pt-2 text-xs">
            <button onClick={() => { setStep("phone"); setCode(""); verifyOtp.reset(); }} className="text-stone-500 underline">
              Use a different number
            </button>
            {cooldown > 0 ? (
              <span className="text-stone-500">Resend code in {cooldown}s</span>
            ) : (
              <button onClick={resend} disabled={requestOtp.isPending} className="font-semibold text-emerald-800 disabled:opacity-50">
                Resend code
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
