import { TRPCError } from "@trpc/server";
import { redis } from "./redis";

/**
 * Fixed-window rate limiter. Fails OPEN on Redis errors (logs a warning,
 * lets the request through) rather than failing closed — a Redis outage
 * should degrade rate limiting, not take down the whole API. This is a
 * disclosed tradeoff, not an oversight: rate limiting here is defense in
 * depth (OTP attempts are also capped in Postgres, independent of Redis),
 * not the only control standing between the app and abuse.
 */
export async function rateLimit(params: { scope: string; identifier: string; limit: number; windowSeconds: number }): Promise<void> {
  const key = `ratelimit:${params.scope}:${params.identifier}`;

  let count: number;
  try {
    count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, params.windowSeconds);
    }
  } catch (err) {
    console.warn(`[rateLimit] Redis unavailable, failing open for ${key}:`, err);
    return;
  }

  if (count > params.limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again in a few minutes.",
    });
  }
}
