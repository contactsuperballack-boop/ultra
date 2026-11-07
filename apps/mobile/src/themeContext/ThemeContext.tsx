import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS as LIGHT } from "../theme";

/**
 * Dark palette — the background (#000E27) is sampled directly from the
 * onboarding hero screen in the provided mockup, not invented to "look
 * dark." Card/border/text values are new (the mockup only showed one dark
 * screen, not a full dark-mode UI), chosen to sit comfortably against
 * that sampled background rather than guessed independently of it.
 */
export const DARK_COLORS = {
  green: "#3B7DFF", // accent blue, lightened slightly for AA contrast against a near-black background
  greenDark: "#1055EA",
  greenSoft: "#12224A",
  bg: "#000E27",
  ink: "#F5F7FA",
  inkSoft: "#94A3C4",
  gold: "#E0B563", // gold, lightened slightly for the same contrast reason
  goldSoft: "#2A2416",
  line: "#1E2F52",
  card: "#0B1B3A",
  accent: "#3B7DFF",
  accentSoft: "#12224A",
  brandNavy: "#0B2A5A",
};

export type ThemeColors = typeof LIGHT;
export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "ultra_theme_mode";

/**
 * Wraps the whole app (see App.tsx). "system" follows the OS-level
 * appearance setting via useColorScheme() and updates live if the person
 * changes it in their phone's settings while the app is open — "light"
 * and "dark" are explicit overrides that ignore the OS setting entirely.
 *
 * SCOPE, STATED PLAINLY: this context and its `colors` are fully wired
 * into SearchScreen, SettingsScreen, ServicesScreen, and
 * ServiceProviderDetailScreen — the screens this pass touched. Every
 * other existing screen (ListingDetail, Saved, Messages, Profile,
 * Notifications) still imports the static `COLORS` from ../theme
 * directly and will NOT change appearance in dark mode yet. That's a
 * real, disclosed scope limit, not a bug — migrating them is
 * mechanical (swap `COLORS` for `useTheme().colors`) but wasn't done
 * across the whole app in this pass.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") setModeState(stored);
      setLoaded(true);
    });
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  const resolvedMode: "light" | "dark" = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const colors = resolvedMode === "dark" ? DARK_COLORS : LIGHT;

  // Don't flash the wrong theme for the one frame before AsyncStorage
  // resolves — render nothing rather than a guaranteed-wrong guess.
  if (!loaded) return null;

  return <ThemeContext.Provider value={{ mode, resolvedMode, colors, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() called outside ThemeProvider — check App.tsx wraps the tree.");
  return ctx;
}
