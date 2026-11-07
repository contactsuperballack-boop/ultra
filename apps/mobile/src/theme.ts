// Kept in sync with apps/web/tailwind.config.ts by hand for now.
// Once both apps stabilize, this should move to packages/config and be
// imported by both, rather than duplicated.
//
// Colors below are sampled directly from the provided brand assets
// (logo + app mockup), not approximated by eye:
//   - accent blue  #1055EA — sampled from the mockup's "Get Started"
//     button, VERIFIED badges, and price text (most common pixel value
//     across 57,806 matching pixels)
//   - brand navy   #0B2A5A — sampled from the ULTRA house/checkmark mark
//   - gold         #D2A03E — sampled from the checkmark itself
//   - dark bg      #000E27 — sampled from the onboarding hero screen
//   - light bg     #F6F6F7 — sampled from the search/home screen
//
// `green`/`greenDark`/`greenSoft` are KEPT as key names (every screen
// built before this pass references COLORS.green as "the primary brand
// color") but their VALUES now point at the real ULTRA brand blue rather
// than the old placeholder forest-green — the previous palette had no
// relationship to the actual brand assets at all. This means every
// existing screen picks up the correct brand color automatically, without
// each one needing an individual edit — a deliberate reuse of the
// existing key names, not an oversight. `accent`/`accentSoft`/
// `brandNavy` are the same colors under clearer names for anything
// written after this pass.
//
// This file is the LIGHT palette and stays exported as COLORS for
// backward compatibility — screens not yet migrated to ThemeContext (see
// theme/ThemeContext.tsx's own comment for exactly which ones ARE
// migrated) continue to import this directly and are unaffected by dark
// mode, but DO get the corrected brand colors.
export const COLORS = {
  green: "#1055EA", // was #1F4D3A — see comment above
  greenDark: "#0B3FB0", // was #163A2B
  greenSoft: "#E8EFFE", // was #E7EEE9
  bg: "#F6F6F7",
  ink: "#0B1220",
  inkSoft: "#6B7280",
  gold: "#D2A03E",
  goldSoft: "#F3E7CE",
  line: "#E5E7EB",
  card: "#FFFFFF",
  accent: "#1055EA",
  accentSoft: "#E8EFFE",
  brandNavy: "#0B2A5A",
};
