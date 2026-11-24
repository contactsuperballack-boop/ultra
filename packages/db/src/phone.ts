// Nigerian mobile numbers, as people actually type them -> the one format the
// API accepts (+234 followed by exactly 10 digits). Pure; used by web and mobile.

/**
 * Accepts: 08031234567, 8031234567, 2348031234567, +2348031234567,
 * +234 803 123 4567, +2340803 123 4567 (stray zero), 002348031234567,
 * with spaces, dashes, dots or brackets. Returns "+2348031234567", or null
 * when it isn't a Nigerian mobile number (mobile numbers start 7, 8 or 9
 * after the country code and are 10 digits long).
 */
export function normalizeNigerianPhone(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(s)) return null;

  s = s.replace(/^\+/, "");
  if (s.startsWith("00")) s = s.slice(2); // international dialling prefix
  if (s.startsWith("234")) s = s.slice(3); // country code
  if (s.startsWith("0")) s = s.slice(1); // national trunk zero (also the stray one after +234)

  return /^[789]\d{9}$/.test(s) ? `+234${s}` : null;
}

/** For display only: +2348031234567 -> "+234 803 123 4567". */
export function formatNigerianPhone(e164: string): string {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
