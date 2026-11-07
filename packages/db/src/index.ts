import { PrismaClient } from "@prisma/client";

// Standard Next.js-safe singleton pattern — prevents exhausting DB
// connections from hot-reload spawning a new PrismaClient per request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export * from "@prisma/client";
export * from "./priceBand";
export * from "./commission";
export * from "./duplicateDetection";
export * from "./platformConfig";
export * from "./listingTransitions";
