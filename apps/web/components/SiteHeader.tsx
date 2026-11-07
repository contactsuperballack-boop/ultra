"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { session } from "@/lib/session";
import { PHASE2_ENABLED } from "@/lib/featureFlags";

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(!!session.accessToken);
  }, []);

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg text-emerald-900">
          ULTRA
        </Link>
        <nav className="flex items-center gap-5 text-sm text-stone-600">
          <Link href="/" className="hover:text-emerald-800">Properties</Link>
          {/* Sprint 3 — Phase 2 freeze. Hiding the link is the cosmetic
              half; app/(public)/services/layout.tsx and app/partner/layout.tsx
              are the actual enforcement underneath it. */}
          {PHASE2_ENABLED && <Link href="/services" className="hover:text-teal-800">Services</Link>}
          {signedIn ? (
            <>
              <Link href="/messages" className="hover:text-emerald-800">Messages</Link>
              {PHASE2_ENABLED && <Link href="/bookings" className="hover:text-teal-800">Bookings</Link>}
              <Link href="/notifications" className="hover:text-emerald-800">Notifications</Link>
              <Link href="/account" className="hover:text-stone-900">Account</Link>
              <Link href="/dashboard/listings" className="hover:text-emerald-800">Realtor dashboard</Link>
              {PHASE2_ENABLED && <Link href="/partner/dashboard" className="hover:text-teal-800">Partner dashboard</Link>}
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hover:text-emerald-800">Sign in</Link>
              <Link href="/dashboard/verification" className="text-emerald-800 font-medium">List with us</Link>
              {PHASE2_ENABLED && <Link href="/partner/verification" className="text-teal-800 font-medium">Offer services</Link>}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
