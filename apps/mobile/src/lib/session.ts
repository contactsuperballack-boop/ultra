import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "ultra_access_token";
const REFRESH_KEY = "ultra_refresh_token";

// SecureStore (Keychain on iOS, Keystore on Android) rather than AsyncStorage —
// these are auth tokens, not app preferences.
export const session = {
  async get() {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    return { accessToken, refreshToken };
  },
  async set(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
  },
};
