import * as SecureStore from "expo-secure-store";

/**
 * Backed by iOS Keychain / Android Keystore-encrypted EncryptedSharedPreferences — see
 * docs/PRODUCT_AND_COMPLIANCE.md §7. Never store tokens in AsyncStorage or plain JS state that
 * could be serialized elsewhere.
 */
const ACCESS_TOKEN_KEY = "sylph.accessToken";
const REFRESH_TOKEN_KEY = "sylph.refreshToken";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setStoredTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearStoredTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
