import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import type { AuthUser, ModuleKey } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasPermission: (module: ModuleKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    const handleUnauthorized = () => {
      setStoredToken(null);
      setUser(null);
    };
    window.addEventListener('easybill:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('easybill:unauthorized', handleUnauthorized);
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (module: ModuleKey) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return Boolean(user.permissions?.[module]);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
