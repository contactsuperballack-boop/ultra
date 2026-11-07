/**
 * Sprint 3 (Sprint 1B Delta Audit's core recommendation): "Freeze public
 * Phase 2 exposure. Fix the Phase 1 trust boundaries first... A feature
 * flag or separate deployment boundary is preferable to relying only on
 * UI omission."
 *
 * Defaults to DISABLED (frozen) when unset — Phase 2 only becomes publicly
 * reachable by deliberately setting the env var, never by forgetting to
 * unset one. This is the same "fail closed, not open" instinct
 * lib/rateLimit.ts documents for its own Redis-unreachable case, applied
 * to a product-sequencing decision instead of an infra one.
 *
 * NEXT_PUBLIC_-prefixed so the same constant is readable both in Server
 * Components (route/layout gating — the actual enforcement) and in
 * Client Components like SiteHeader (nav-link hiding — cosmetic, not the
 * boundary itself). Both matter: hiding a nav link without also blocking
 * the route underneath it is exactly the "relying only on UI omission"
 * pattern the audit called out as insufficient.
 */
export const PHASE2_ENABLED = process.env.NEXT_PUBLIC_PHASE2_ENABLED === "true";
