import { createHash, randomInt } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between requests for the same phone

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * SMS provider interface — kept separate from the OTP router logic so the
 * real Termii integration and the dev mock are interchangeable behind one
 * seam (framework Rule 10: isolate unavailable external services behind an
 * interface rather than faking that the integration works).
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Real implementation — requires TERMII_API_KEY. Not exercised until that env var is set. */
export class TermiiSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    const apiKey = process.env.TERMII_API_KEY;
    if (!apiKey) {
      throw new Error("TERMII_API_KEY is not set — cannot send real SMS. Use DevConsoleSmsProvider in development.");
    }
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: phone,
        from: "ULTRA",
        sms: `Your ULTRA verification code is ${code}. It expires in 5 minutes.`,
        type: "plain",
        channel: "generic",
      }),
    });
    if (!res.ok) {
      throw new Error(`Termii SMS send failed: ${res.status} ${await res.text()}`);
    }
  }
}

/** Dev/test provider — logs the code instead of sending a real SMS. Never used if TERMII_API_KEY is set. */
export class DevConsoleSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[DEV SMS MOCK] OTP for ${phone}: ${code} (expires in 5 min)`);
  }
}

export function getSmsProvider(): SmsProvider {
  if (process.env.TERMII_API_KEY) return new TermiiSmsProvider();

  // Hardening fix: without this check, a misconfigured production deploy
  // (TERMII_API_KEY simply forgotten) would silently fall back to logging
  // real OTP codes to server logs — a genuine account-takeover risk, not a
  // theoretical one. Fail loudly instead. Dev/test environments still get
  // the console fallback, which is what makes local development usable
  // without a real SMS provider.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TERMII_API_KEY is not set in a production environment. Refusing to fall back to logging OTP codes to server logs. Set TERMII_API_KEY before deploying — see .env.example."
    );
  }

  return new DevConsoleSmsProvider();
}
