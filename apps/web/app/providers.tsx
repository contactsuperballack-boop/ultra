"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { getValidAccessToken } from "@/lib/authRefresh";
import { createAppQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          headers: async () => {
            // Proactively refreshes an about-to-expire token before the
            // request goes out, rather than letting it 401 and retrying —
            // closes the "session silently dies after 15 minutes" gap
            // flagged in both the technical spec and the audit.
            const token = await getValidAccessToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
