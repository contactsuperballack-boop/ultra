// Support contacts come from the environment, never hardcoded: a contact
// that nobody monitors is worse than none. UI hides a channel when unset.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ""; // digits only, e.g. 2348012345678
