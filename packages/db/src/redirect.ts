// Where to send someone after they sign in. The destination can come from a
// URL (?next=...), so it must never be able to point off-site.

export type Role = "BUYER" | "REALTOR" | "PROVIDER" | "ADMIN" | "SUPER_ADMIN" | string;

/**
 * Accepts only a same-site absolute path ("/listings/abc?x=1"). Rejects
 * protocol-relative ("//evil.com"), backslash tricks ("/\evil.com"), full URLs,
 * control characters, and anything that loops back to the login page.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 500) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  if (next === "/auth/login" || next.startsWith("/auth/login?") || next.startsWith("/auth/login/")) return fallback;
  return next;
}

/** Default landing page for a role when there's no `next`. Buyers land on the homepage, not a realtor dashboard. */
export function landingFor(role: Role, opts: { phase2Enabled?: boolean } = {}): string {
  switch (role) {
    case "REALTOR":
      return "/dashboard/listings";
    case "PROVIDER":
      return opts.phase2Enabled ? "/partner/dashboard" : "/";
    case "ADMIN":
    case "SUPER_ADMIN":
      return "/admin/verification";
    default:
      return "/";
  }
}
