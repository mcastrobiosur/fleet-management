import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiFetch, setTokens, clearTokens } from '../api/client';
import React from 'react';

interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: 'conductor' | 'administrador' | 'equipo_mantenimiento';
}

interface UnidadAsignada {
  id: string;
  marca: string;
  modelo: string;
  patente: string;
  anio: number;
  estado: string;
}

interface AuthState {
  user: UserProfile | null;
  unidadAsignada: UnidadAsignada | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<unknown>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [unidadAsignada, setUnidadAsignada] = useState<UnidadAsignada | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    const storedUnidad = localStorage.getItem('unidadAsignada');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        if (storedUnidad) setUnidadAsignada(JSON.parse(storedUnidad));
        setIsAuthenticated(true);
      } catch {
        clearTokens();
        localStorage.removeItem('user');
        localStorage.removeItem('unidadAsignada');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: UserProfile;
      unidadAsignada?: UnidadAsignada;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);

    if (data.unidadAsignada) {
      localStorage.setItem('unidadAsignada', JSON.stringify(data.unidadAsignada));
      setUnidadAsignada(data.unidadAsignada);
    } else {
      localStorage.removeItem('unidadAsignada');
      setUnidadAsignada(null);
    }

    setIsAuthenticated(true);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch { /* proceed */ }
    clearTokens();
    localStorage.removeItem('user');
    localStorage.removeItem('unidadAsignada');
    setUser(null);
    setUnidadAsignada(null);
    setIsAuthenticated(false);
  }, []);

  return React.createElement(
    AuthContext.Provider,
    { value: { user, unidadAsignada, isAuthenticated, isLoading, login, logout } },
    children,
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
