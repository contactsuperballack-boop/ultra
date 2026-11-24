// MIRROR of packages/db/src/inspection.ts — keep in sync (same pattern as theme.ts, mortgage.ts, listingFeatures.ts, searchFilters.ts).
// Inspection requests: a buyer asks to see a property (in person, by video,
// or to review the title with their own adviser); the realtor accepts,
// declines or proposes another time. Pure rules only — no I/O — so the same
// logic is enforced by the API and shown identically in every client.

export type InspectionKind = "PHYSICAL" | "VIRTUAL" | "TITLE_DILIGENCE";
export type InspectionSlot = "MORNING" | "AFTERNOON" | "EVENING";
export type InspectionStatus = "REQUESTED" | "ACCEPTED" | "RESCHEDULE_PROPOSED" | "DECLINED" | "CANCELLED" | "COMPLETED";
export type InspectionAction = "ACCEPT" | "DECLINE" | "RESCHEDULE" | "CANCEL" | "ACCEPT_RESCHEDULE" | "COMPLETE";
export type InspectionActor = "BUYER" | "REALTOR";

export const INSPECTION_KINDS: { value: InspectionKind; label: string; hint: string }[] = [
  { value: "PHYSICAL", label: "Visit in person", hint: "Walk through the property with the realtor." },
  { value: "VIRTUAL", label: "Video viewing", hint: "A live walkthrough over a video call." },
  { value: "TITLE_DILIGENCE", label: "Title review", hint: "Go through ownership documents with your own adviser." },
];

export const INSPECTION_SLOTS: { value: InspectionSlot; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
];

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  REQUESTED: "Awaiting response",
  ACCEPTED: "Confirmed",
  RESCHEDULE_PROPOSED: "New time proposed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const MAX_ADVANCE_DAYS = 90;
export const MAX_OPEN_REQUESTS_PER_LISTING = 3;
export const OPEN_STATUSES: readonly InspectionStatus[] = ["REQUESTED", "ACCEPTED", "RESCHEDULE_PROPOSED"];

export const kindLabel = (k: InspectionKind) => INSPECTION_KINDS.find((x) => x.value === k)?.label ?? k;
export const slotLabel = (s: InspectionSlot) => INSPECTION_SLOTS.find((x) => x.value === s)?.label ?? s;

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date in Nigeria (WAT, UTC+1, no daylight saving) as YYYY-MM-DD. */
export function todayInNigeria(now: Date = new Date()): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ymdToUtcMs(ymd: string): number | null {
  const m = YMD.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // Reject impossible dates like 2026-02-31, which Date.UTC silently rolls over.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

export type DateCheck = { ok: true } | { ok: false; reason: string };

/** A requested visit must be a real calendar date from tomorrow up to 90 days ahead (Nigeria time). */
export function validateInspectionDate(ymd: string, todayYmd: string = todayInNigeria()): DateCheck {
  const target = ymdToUtcMs(ymd);
  const today = ymdToUtcMs(todayYmd);
  if (target === null || today === null) return { ok: false, reason: "Choose a valid date." };
  const days = Math.round((target - today) / 86_400_000);
  if (days < 1) return { ok: false, reason: "Choose a date from tomorrow onwards." };
  if (days > MAX_ADVANCE_DAYS) return { ok: false, reason: `Choose a date within the next ${MAX_ADVANCE_DAYS} days.` };
  return { ok: true };
}

type Rule = { actors: InspectionActor[]; from: InspectionStatus[]; to: InspectionStatus };

const RULES: Record<InspectionAction, Rule> = {
  ACCEPT: { actors: ["REALTOR"], from: ["REQUESTED"], to: "ACCEPTED" },
  DECLINE: { actors: ["REALTOR"], from: ["REQUESTED"], to: "DECLINED" },
  RESCHEDULE: { actors: ["REALTOR"], from: ["REQUESTED", "ACCEPTED"], to: "RESCHEDULE_PROPOSED" },
  CANCEL: { actors: ["BUYER", "REALTOR"], from: ["REQUESTED", "RESCHEDULE_PROPOSED", "ACCEPTED"], to: "CANCELLED" },
  ACCEPT_RESCHEDULE: { actors: ["BUYER"], from: ["RESCHEDULE_PROPOSED"], to: "ACCEPTED" },
  COMPLETE: { actors: ["REALTOR"], from: ["ACCEPTED"], to: "COMPLETED" },
};

export type ActionResult = { ok: true; next: InspectionStatus } | { ok: false; reason: string };

/** What happens when `actor` takes `action` on a request currently in `status`. */
export function applyInspectionAction(status: InspectionStatus, action: InspectionAction, actor: InspectionActor): ActionResult {
  const rule = RULES[action];
  if (!rule.actors.includes(actor)) return { ok: false, reason: "You can't take that action on this request." };
  if (!rule.from.includes(status)) return { ok: false, reason: `This request is ${INSPECTION_STATUS_LABELS[status].toLowerCase()}, so that isn't possible now.` };
  return { ok: true, next: rule.to };
}

/** Actions each side is offered for a request in a given status (used to render buttons). */
export function availableActions(status: InspectionStatus, actor: InspectionActor): InspectionAction[] {
  return (Object.keys(RULES) as InspectionAction[]).filter((a) => RULES[a].actors.includes(actor) && RULES[a].from.includes(status));
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat 15 Nov 2026". Hand-formatted (no Intl) so it's identical on web, server and React Native. */
export function formatInspectionDate(ymdOrDate: string | Date): string {
  const d = typeof ymdOrDate === "string" ? new Date(`${ymdOrDate.slice(0, 10)}T00:00:00Z`) : ymdOrDate;
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The next `count` bookable dates (starting tomorrow, Nigeria time) as YYYY-MM-DD. */
export function upcomingInspectionDates(count = 21, todayYmd: string = todayInNigeria()): string[] {
  const base = ymdToUtcMs(todayYmd);
  if (base === null) return [];
  return Array.from({ length: Math.min(count, MAX_ADVANCE_DAYS) }, (_, i) => new Date(base + (i + 1) * 86_400_000).toISOString().slice(0, 10));
}
