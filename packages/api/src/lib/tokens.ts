import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to .env — see .env.example.");
  }
  return secret;
}

export interface AccessTokenPayload {
  sub: string; // userId
  role: "BUYER" | "REALTOR" | "ADMIN" | "SUPER_ADMIN";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
  } catch {
    return null; // expired or tampered — caller treats as unauthenticated
  }
}

/** Raw refresh token is returned to the client once and never stored — only its hash lives in the DB. */
export function generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("hex");
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
