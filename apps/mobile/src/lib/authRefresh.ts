import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import Constants from "expo-constants";
import type { AppRouter } from "@ultra/api";
import { session } from "./session";

const apiUrl = (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:3000/api/trpc";

// Standalone client for the refresh call itself, same reasoning as the web
// version — can't call the React-hooks client from inside its own headers().
const refreshClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: apiUrl, transformer: superjson })],
});

const REFRESH_BUFFER_MS = 60_000;

// Manual base64url decode — no dependency on `atob` (not guaranteed across
// Hermes/RN versions) or the Node `Buffer` global (not present in React
// Native without an explicit polyfill this project doesn't have). Pure JS,
// works in any JS engine.
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const char of padded) {
    if (char === "=") break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

function getExpiryMs(jwt: string): number | null {
  try {
    const payload = jwt.split(".")[1];
    const parsed = JSON.parse(base64UrlDecode(payload));
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

export async function getValidAccessToken(): Promise<string | null> {
  const { accessToken, refreshToken } = await session.get();
  if (!accessToken || !refreshToken) return null;

  const expiryMs = getExpiryMs(accessToken);
  const needsRefresh = expiryMs === null || expiryMs - Date.now() < REFRESH_BUFFER_MS;
  if (!needsRefresh) return accessToken;

  if (!refreshInFlight) {
    refreshInFlight = refreshClient.auth.refresh
      .mutate({ refreshToken })
      .then(async (result) => {
        await session.set(result.accessToken, result.refreshToken);
        return result.accessToken;
      })
      .catch(async () => {
        await session.clear();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}
