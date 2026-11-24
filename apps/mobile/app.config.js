/**
 * Dynamic config (replaces the earlier static app.json) specifically so
 * eas.json's per-profile "env" values actually reach the app — a static
 * app.json can't read process.env at build time, which meant development,
 * preview, and production builds would previously all silently point at
 * the same hardcoded API URL. See eas.json for what each profile sets.
 */
const appVariant = process.env.APP_VARIANT ?? "dev";
const configuredApiUrl = process.env.API_URL ?? "http://localhost:3000/api/trpc";
if (appVariant === "production" && !configuredApiUrl.startsWith("https://")) {
  throw new Error("Production mobile builds require API_URL to use HTTPS.");
}

export default {
  expo: {
    name: process.env.APP_VARIANT === "production" ? "ULTRA" : `ULTRA (${process.env.APP_VARIANT ?? "dev"})`,
    slug: "ultra-app",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      backgroundColor: "#000E27",
      resizeMode: "contain",
    },
    ios: {
      supportsTablet: false,
      // Distinct bundle IDs per environment — lets development/preview/
      // production builds be installed side by side on the same device
      // rather than overwriting each other, which matters a lot once
      // you're testing a staging build while a production build is also
      // installed.
      bundleIdentifier:
        process.env.APP_VARIANT === "production" ? "com.ultra.app" : `com.ultra.app.${process.env.APP_VARIANT ?? "dev"}`,
    },
    android: {
      package:
        process.env.APP_VARIANT === "production" ? "com.ultra.app" : `com.ultra.app.${process.env.APP_VARIANT ?? "dev"}`,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#F6F6F7",
      },
    },
    extra: {
      apiUrl: configuredApiUrl,
      sentryDsn: process.env.SENTRY_DSN, // undefined is fine — initSentry() treats that as "disabled"
      // Sprint 3 — mirrors apps/web/lib/featureFlags.ts's Phase 2 freeze.
      // Fails closed: anything other than the literal string "true" keeps
      // the Services entry point in a "coming soon" state, same as the
      // existing Mortgage placeholder already does.
      // Optional support channels; the Help sheet only shows a channel that is set.
      // Public website base (e.g. https://ultraapp.ng) — lets the app hand off to web-only features like the 3D viewer.
      webUrl: process.env.WEB_URL,
      supportEmail: process.env.SUPPORT_EMAIL,
      supportWhatsapp: process.env.SUPPORT_WHATSAPP, // digits only
      homeServicesEnabled: process.env.HOME_SERVICES_ENABLED === "true" || process.env.PHASE2_ENABLED === "true",
      phase2Enabled: process.env.HOME_SERVICES_ENABLED === "true" || process.env.PHASE2_ENABLED === "true",
      // Mortgage stays "Coming Soon" until the owner decides otherwise (docs/PRODUCT_SCOPE.md).
      mortgageEnabled: process.env.MORTGAGE_ENABLED === "true",
      eas: {
        // Populated by `eas init` — left as a placeholder since this
        // codebase was never connected to a real Expo/EAS project.
        projectId: "REPLACE_WITH_REAL_EAS_PROJECT_ID",
      },
    },
    plugins: ["expo-notifications"],
  },
};
