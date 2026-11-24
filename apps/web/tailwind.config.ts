import type { Config } from "tailwindcss";

// Brand palette sampled from the provided ULTRA mockups (same values as
// apps/mobile/src/theme.ts): accent blue #1055EA, navy #0B2A5A, gold #D2A03E.
//
// Existing screens reference `emerald-*` as "the primary brand color" and
// `teal-*` as the Phase 2 (services) accent. Rather than touch ~100 class
// names, the scale KEYS are kept and their VALUES now point at the real
// brand: emerald → brand blue, teal → brand navy. New code should prefer
// `brand-*` names; `amber-500` is the brand gold.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1055EA", dark: "#0B3FB0", soft: "#E8EFFE", navy: "#0B2A5A", ink: "#000E27", gold: "#D2A03E" },
        emerald: {
          50: "#F1F5FF", 100: "#E8EFFE", 200: "#C7D7FD", 300: "#9DB8FB", 400: "#5C86F5",
          500: "#2F6BEF", 600: "#1B5FEF", 700: "#0B3FB0", 800: "#1055EA", 900: "#0B2A5A",
        },
        teal: {
          50: "#EFF3F9", 100: "#DCE5F2", 200: "#B9C9E3", 300: "#8FA8CF", 400: "#5F7FB3",
          500: "#3A5C99", 600: "#1F4580", 700: "#123A78", 800: "#0B2A5A", 900: "#071C3D",
        },
        amber: { 500: "#D2A03E" },
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
