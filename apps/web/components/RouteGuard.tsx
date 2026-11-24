"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

type Role = "BUYER" | "REALTOR" | "PROVIDER" | "ADMIN" | "SUPER_ADMIN";

/**
 * Generalized from the original admin-only guard, per the audit finding
 * that /dashboard (realtor routes) had no equivalent protection — an
 * unauthenticated user could previously fill out the entire listing form
 * before discovering at submit time that they were never signed in.
 *
 * `allowedRoles` is optional deliberately: /dashboard can't be gated to
 * REALTOR-only, because /dashboard/verification is exactly the page a
 * signed-in BUYER visits to *become* a realtor — role-restricting the
 * whole section would lock out every new applicant before they could ever
 * apply. Omit `allowedRoles` to require only "signed in, any role."
 *
 * This is a UX improvement, not the security boundary: server-side role
 * and verification-status checks (adminProcedure, verifiedRealtorProcedure)
 * remain the actual enforcement regardless of what this component does.
 */
export function RouteGuard({ allowedRoles, children }: { allowedRoles?: Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const { data: me, isLoading, isError } = trpc.auth.me.useQuery(undefined, {
    retry: false, // an auth failure here means "not signed in," not "try again"
  });

  const isAllowed = !!me && (!allowedRoles || allowedRoles.includes(me.role as Role));

  useEffect(() => {
    if (isLoading) return;
    if (isError || !me) {
      router.replace(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
    } else if (!isAllowed) {
      // Signed in, just not allowed here (e.g. a buyer opening a realtor page): sending them to sign in again makes no sense.
      router.replace("/");
    }
  }, [isLoading, isError, isAllowed, me, router]);

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-6 py-10 text-sm text-stone-500">Checking access\u2026</div>;
  }
  if (isError || !isAllowed) {
    return null; // redirect is already underway; avoid a flash of protected content
  }

  return <>{children}</>;
}
