import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set. Rate limiting requires Redis — see .env.example / docker-compose.yml.");
  }
  return new Redis(url, {
    // Don't let a Redis outage take down the whole app on connect — retry
    // with backoff, and callers of rateLimit() handle a Redis error as
    // "fail open" rather than crashing the request (see lib/rateLimit.ts).
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
}

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
