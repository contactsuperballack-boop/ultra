import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import Constants from "expo-constants";
import type { AppRouter } from "@ultra/api";
import { getValidAccessToken } from "./authRefresh";

export const trpc = createTRPCReact<AppRouter>();

const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:3000/api/trpc";

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: apiUrl,
        transformer: superjson,
        headers: async () => {
          // Proactive refresh — closes the same "session dies after 15
          // minutes" gap fixed on web (lib/authRefresh.ts).
          const accessToken = await getValidAccessToken();
          return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
        },
      }),
    ],
  });
}
