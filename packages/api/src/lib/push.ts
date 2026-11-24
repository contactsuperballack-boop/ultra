/**
 * Push provider interface — mirrors the SmsProvider pattern in lib/otp.ts.
 * Unlike Termii/Paystack, Expo Push doesn't require a server-side secret
 * for basic sends, so there's no "unconfigured" failure mode to gate on —
 * the only real failure mode is "this user has no push token yet" (never
 * granted permission, or hasn't opened the app since notifications.ts
 * shipped), which is handled by simply not sending, not by faking success.
 */
export interface PushProvider {
  send(expoPushToken: string, title: string, body: string, data?: Record<string, unknown>): Promise<void>;
}

export class ExpoPushProvider implements PushProvider {
  async send(expoPushToken: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    if (!expoPushToken.startsWith("ExponentPushToken")) {
      // Not a real Expo token (e.g. a leftover dev value) — skip rather than
      // let Expo's API reject it, so one bad token doesn't throw and abort
      // whatever business logic triggered the notification.
      console.warn(`[push] Skipping send — not a valid Expo push token: ${expoPushToken.slice(0, 12)}...`);
      return;
    }
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: expoPushToken, title, body, data, sound: "default" }),
    });
    if (!res.ok) {
      // Logged, not thrown — a failed push should never fail the underlying
      // action (e.g. sending a message) that triggered the notification.
      console.error(`[push] Expo push send failed: ${res.status} ${await res.text()}`);
    }
  }
}

export function getPushProvider(): PushProvider {
  return new ExpoPushProvider();
}
