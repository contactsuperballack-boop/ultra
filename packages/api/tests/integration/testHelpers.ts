import { db } from "@ultra/db";
import { appRouter, createContext } from "../../src";
import { signAccessToken } from "../../src/lib/tokens";

/**
 * Creates a real user (and optionally a VERIFIED realtor profile) in the
 * test database, signs a real access token for them, and builds a caller
 * through the actual createContext path — this exercises the exact same
 * auth/role-resolution code a real request goes through, rather than
 * constructing a Context object by hand and bypassing it.
 */
export async function createAuthedCaller(opts: {
  role: "BUYER" | "REALTOR" | "PROVIDER" | "ADMIN" | "SUPER_ADMIN";
  phone: string;
  realtor?: { agencyName: string; creditBalanceNaira?: bigint };
  // Phase 2 mirror of the `realtor` option above — same shape, same
  // "create it VERIFIED directly, skip the application/approval dance"
  // convenience for tests that aren't testing the verification flow
  // itself.
  provider?: { businessName: string; categories?: ("PAINTING" | "PLUMBING" | "FUMIGATION" | "ELECTRICAL" | "SOLAR" | "CCTV" | "SECURITY_SYSTEMS" | "FURNITURE" | "CLEANING" | "MOVE_IN" | "PEST_CONTROL")[]; freeUntil?: Date };
}) {
  const user = await db.user.create({
    data: {
      phone: opts.phone,
      phoneVerified: true,
      name: `Test ${opts.role}`,
      role: opts.role,
      ...(opts.realtor && {
        realtorProfile: {
          create: {
            agencyName: opts.realtor.agencyName,
            verificationStatus: "VERIFIED",
            verifiedAt: new Date(),
            creditBalanceNaira: opts.realtor.creditBalanceNaira ?? 0n,
          },
        },
      }),
      ...(opts.provider && {
        providerProfile: {
          create: {
            businessName: opts.provider.businessName,
            categories: opts.provider.categories ?? ["PLUMBING"],
            verificationStatus: "VERIFIED",
            verifiedAt: new Date(),
            freeUntil: opts.provider.freeUntil,
          },
        },
      }),
    },
    include: { realtorProfile: true, providerProfile: true },
  });

  const token = signAccessToken({ sub: user.id, role: opts.role });
  const ctx = await createContext({ authHeader: `Bearer ${token}` });
  const caller = appRouter.createCaller(ctx);

  return { user, caller };
}
