"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@ultra/api";
import { session } from "./session";

// A standalone (non-React-hooks) tRPC client, used only for the refresh
// call itself — the React-hooks client (lib/trpc.ts) can't be called
// imperatively from inside its own headers() callback without creating a
// circular dependency.
const refreshClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

const REFRESH_BUFFER_MS = 60_000; // refresh if expiring within 60s, not exactly at the deadline

/**
 * Reads the `exp` claim out of a JWT without verifying its signature —
 * that's fine here, this is purely a client-side UX optimization to decide
 * *when* to proactively refresh. The server independently and always
 * verifies the signature on every real request; this check being wrong in
 * either direction just means one extra refresh call or one request that
 * gets a real 401, not a security issue.
 */
function getExpiryMs(jwt: string): number | null {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null; // malformed token — let the request proceed and fail naturally with a real 401
  }
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Returns a definitely-valid access token, refreshing first if the current
 * one is expired or about to expire. Concurrent callers (e.g. a batch of
 * simultaneous queries on page load) share one in-flight refresh rather
 * than each independently rotating the refresh token — a second rotation
 * would invalidate the first response mid-flight (see auth.ts's refresh
 * mutation: each call revokes the previous refresh token).
 */
export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = session.accessToken;
  const refreshToken = session.refreshToken;
  if (!accessToken || !refreshToken) return null;

  const expiryMs = getExpiryMs(accessToken);
  const needsRefresh = expiryMs === null || expiryMs - Date.now() < REFRESH_BUFFER_MS;
  if (!needsRefresh) return accessToken;

  if (!refreshInFlight) {
    refreshInFlight = refreshClient.auth.refresh
      .mutate({ refreshToken })
      .then((result) => {
        session.set(result.accessToken, result.refreshToken);
        return result.accessToken;
      })
      .catch(() => {
        // Refresh token itself is expired/revoked — genuinely signed out,
        // not a transient error. Clear the session rather than retry.
        session.clear();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}
