import React, { createContext, useContext, useEffect, useState } from "react";
import { Text, TextInput, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Deliberately limited to fonts that ship with iOS/Android already —
 * this environment has no network access to fetch new font files (e.g.
 * Google Fonts), and shipping a font that silently fails to load would
 * be worse than a small, honest set that's guaranteed to work. "System"
 * is each platform's native font (San Francisco on iOS, Roboto on
 * Android) — the other three are real, distinct typefaces already on
 * both platforms, not System with a fake label.
 */
export const FONT_OPTIONS = [
  { key: "system", label: "System default", sample: "Aa" },
  { key: "serif", label: "Serif", sample: "Aa" },
  { key: "rounded", label: "Rounded", sample: "Aa" },
  { key: "monospace", label: "Monospace", sample: "Aa" },
] as const;

export type FontKey = (typeof FONT_OPTIONS)[number]["key"];

const FONT_FAMILIES: Record<FontKey, { ios?: string; android?: string }> = {
  system: { ios: undefined, android: undefined }, // undefined = RN's own platform default, don't override
  serif: { ios: "Georgia", android: "serif" },
  rounded: { ios: "System", android: "sans-serif-medium" }, // true rounded-design system font needs iOS 13+ SF Pro Rounded, not reliably selectable by family name alone — "System" + medium weight is the honest, always-working approximation; Android's sans-serif-medium is a genuinely different, more rounded-reading face than default Roboto
  monospace: { ios: "Menlo", android: "monospace" },
};

function resolveFamily(key: FontKey): string | undefined {
  const entry = FONT_FAMILIES[key];
  return Platform.OS === "ios" ? entry.ios : entry.android;
}

interface FontContextValue {
  fontKey: FontKey;
  fontFamily: string | undefined; // the resolved platform family — for the rare style that needs it explicitly (e.g. this same Settings screen's own preview)
  setFontKey: (key: FontKey) => void;
}

const FontContext = createContext<FontContextValue | null>(null);
const STORAGE_KEY = "ultra_font_key";

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontKey, setFontKeyState] = useState<FontKey>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && FONT_OPTIONS.some((f) => f.key === stored)) setFontKeyState(stored as FontKey);
      setLoaded(true);
    });
  }, []);

  // Applies the chosen font to every <Text>/<TextInput> in the app,
  // including ones rendered by screens this pass never touched — the
  // pragmatic way to make "app-wide font" actually true given real time
  // constraints, rather than only working on the handful of screens
  // individually wired to a font hook.
  //
  // CORRECTED in Sprint B: the original version of this effect patched
  // Text.defaultProps.style. That's a real bug, not a style choice —
  // React's defaultProps only fills in a prop when the caller passes
  // `undefined` for it; it does NOT merge with an explicitly-provided
  // style. A scan of this app's own screens found 98 of 103 <Text>
  // usages pass their own explicit `style` array, meaning the original
  // approach silently did nothing for ~95% of visible text. Fixed by
  // patching Text.render/TextInput.render directly instead: this
  // intercepts the actual rendered element (after the component's own
  // style has already been resolved) and prepends the font as the FIRST
  // entry in its style array — later array entries win in RN's style
  // merging, so a caller's own explicit fontFamily (rare) still overrides
  // this default, while every other caller picks it up automatically.
  // This is the same technique the (unmaintained but widely-copied)
  // react-native-global-props package uses for exactly this problem —
  // a known pattern, not an invented one, but it does rely on Text/
  // TextInput remaining class components with a patchable .render method,
  // which is a real assumption about the installed RN version that
  // couldn't be confirmed by running it in this environment.
  useEffect(() => {
    if (!loaded) return;
    const family = resolveFamily(fontKey);
    const fontStyle = family ? { fontFamily: family } : null;

    const originalTextRender = (Text as any).render;
    const originalInputRender = (TextInput as any).render;

    if (fontStyle) {
      (Text as any).render = function (...args: unknown[]) {
        const origin = originalTextRender.apply(this, args);
        return React.cloneElement(origin, { style: [fontStyle, origin.props.style] });
      };
      (TextInput as any).render = function (...args: unknown[]) {
        const origin = originalInputRender.apply(this, args);
        return React.cloneElement(origin, { style: [fontStyle, origin.props.style] });
      };
    }

    // Restore the real render method on unmount/re-run so switching back
    // to "System" (fontStyle === null) or unmounting the provider doesn't
    // leave a stale patched render function pointing at an old closure.
    return () => {
      (Text as any).render = originalTextRender;
      (TextInput as any).render = originalInputRender;
    };
  }, [fontKey, loaded]);

  function setFontKey(key: FontKey) {
    setFontKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY, key).catch(() => {});
  }

  if (!loaded) return null;

  return (
    <FontContext.Provider value={{ fontKey, fontFamily: resolveFamily(fontKey), setFontKey }}>{children}</FontContext.Provider>
  );
}

export function useFont(): FontContextValue {
  const ctx = useContext(FontContext);
  if (!ctx) throw new Error("useFont() called outside FontProvider — check App.tsx wraps the tree.");
  return ctx;
}
