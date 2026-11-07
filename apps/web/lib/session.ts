"use client";

// Plain localStorage is fine here — this is a real browser app, not a
// sandboxed artifact preview. Access tokens are short-lived (15 min);
// refresh token rotation happens in the auth.refresh mutation.
const ACCESS_KEY = "ultra_access_token";
const REFRESH_KEY = "ultra_refresh_token";

export const session = {
  get accessToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(accessToken: string, refreshToken: string) {
    window.localStorage.setItem(ACCESS_KEY, accessToken);
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};
