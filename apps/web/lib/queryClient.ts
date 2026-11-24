import { QueryClient } from "@tanstack/react-query";

/**
 * Audit finding: the default QueryClient() retries every failed query 3x
 * with exponential backoff, including UNAUTHORIZED/FORBIDDEN errors that
 * will never succeed on retry — adding several seconds of silent delay
 * before every "sign in required" message across every auth-gated screen.
 * This applies the same fix on both platforms via one shared factory,
 * rather than patching each affected page individually.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const code = (error as { data?: { code?: string } })?.data?.code;
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return false;
  return failureCount < 3; // otherwise, TanStack Query's normal default
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: false }, // never auto-retry a mutation — risk of double-submitting (e.g. a second inquiry, a second listing)
    },
  });
}
