import { QueryClient } from "@tanstack/react-query";

/**
 * Mirrors apps/web/lib/queryClient.ts — same audit finding, same fix,
 * both platforms. See that file's comment for the full reasoning.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const code = (error as { data?: { code?: string } })?.data?.code;
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return false;
  return failureCount < 3;
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}
