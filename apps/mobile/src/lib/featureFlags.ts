import Constants from "expo-constants";

/** Home Services MVP pilot gate; fail closed unless explicitly enabled at build time. */
export const HOME_SERVICES_ENABLED = Constants.expoConfig?.extra?.homeServicesEnabled === true || Constants.expoConfig?.extra?.phase2Enabled === true;
export const PHASE2_ENABLED = HOME_SERVICES_ENABLED;

/** Mortgage is "Coming Soon" (docs/PRODUCT_SCOPE.md): off unless extra.mortgageEnabled is exactly true. */
export const MORTGAGE_ENABLED = Constants.expoConfig?.extra?.mortgageEnabled === true;
