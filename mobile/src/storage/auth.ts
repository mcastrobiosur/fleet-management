/**
 * Almacenamiento de tokens JWT.
 *
 * En nativo usa expo-secure-store (cifrado).
 * En web usa localStorage como fallback.
 */

import { Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';
const ACCESS_TOKEN_KEY = 'biosur_access_token';
const REFRESH_TOKEN_KEY = 'biosur_refresh_token';

export async function getToken(
  type: 'accessToken' | 'refreshToken' = 'accessToken',
): Promise<string | null> {
  const key = type === 'accessToken' ? ACCESS_TOKEN_KEY : REFRESH_TOKEN_KEY;
  if (IS_WEB) {
    return localStorage.getItem(key);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

export async function setTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  if (IS_WEB) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  if (IS_WEB) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
