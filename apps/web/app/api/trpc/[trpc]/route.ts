import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@ultra/api";
import { NextRequest } from "next/server";

function getClientIp(req: NextRequest): string | null {
  // Vercel and most reverse proxies set x-forwarded-for; take the first
  // (client) hop. Falls back to null rather than throwing — IP-based rate
  // limiting degrades gracefully to phone/user-based limiting alone if this
  // is ever unavailable (e.g. local dev without a proxy in front).
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ authHeader: req.headers.get("authorization"), ipAddress: getClientIp(req) }),
    onError({ error, path }) {
      // 5xx-class errors get reported to Sentry (no-op without SENTRY_DSN
      // configured — see lib/sentry.ts). Expected 4xx errors (UNAUTHORIZED,
      // BAD_REQUEST, etc.) are not noise worth alerting on.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        import("@ultra/api").then(({ reportError }) => reportError(error, { path }));
      }
    },
  });
}

export { handler as GET, handler as POST };
