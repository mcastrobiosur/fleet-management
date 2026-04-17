/**
 * Cliente HTTP para comunicación con el backend Biosur.
 *
 * Adjunta automáticamente el JWT almacenado en SecureStore a cada request.
 * Soporta refresh automático de token cuando el access token expira.
 */

import { getToken, setTokens, clearTokens } from '../storage/auth';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : (process.env.EXPO_PUBLIC_API_BASE_URL ?? '/api');

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Si el token expiró, intentar refresh
  if (response.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(endpoint, options);
    }
    await clearTokens();
    throw new AuthError('Sesión expirada');
  }

  const data = (await response.json()) as T;

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return { data, status: response.status };
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const refreshToken = await getToken('refreshToken');
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    await setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
  ) {
    super(`API Error ${status}`);
    this.name = 'ApiError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
