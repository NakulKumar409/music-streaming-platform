import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';

import { api, JWT_STORAGE_KEY, USER_TOKEN_STORAGE_KEY } from '../services/api';

export type SessionUser = {
  id?: string | number;
  email?: string;
  name?: string;
  status?: AccountStatus;
} & Record<string, unknown>;

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

const SESSION_USER_STORAGE_KEY = 'sessionUser';

type AuthContextValue = {
  token: string | null;
  user: SessionUser | null;
  isRestoring: boolean;
  isLoggingIn: boolean;
  isAuthenticated: boolean;
  userAccountStatus: AccountStatus;
  isAccountSuspended: boolean;
  bootstrapAuth: () => Promise<void>;
  restoreToken: () => Promise<string | null>;
  setToken: (token: string | null) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchSession: () => Promise<SessionUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractToken(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const candidate =
    record.token ?? record.jwt ?? record.accessToken ?? (record.data as any)?.token;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

function extractUser(data: unknown): SessionUser | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const candidate = record.user ?? record.data ?? record.session ?? record;
  return typeof candidate === 'object' && candidate ? (candidate as SessionUser) : null;
}

function extractAccountStatus(data: unknown): AccountStatus | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const user = extractUser(record);

  const candidate =
    (user as any)?.status ??
    (user as any)?.account_status ??
    record.status ??
    record.account_status;

  if (candidate === 'ACTIVE' || candidate === 'SUSPENDED') return candidate;
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Global account status with persistence
  const [userAccountStatus, setUserAccountStatusState] = useState<AccountStatus>('ACTIVE');

  const isAccountSuspended = userAccountStatus === 'SUSPENDED';

  const isAuthenticated = Boolean(token && token.trim().length > 0);

  const restoreToken = useCallback(async () => {
    setIsRestoring(true);
    try {
      const stored =
        (await AsyncStorage.getItem(USER_TOKEN_STORAGE_KEY)) ??
        (await AsyncStorage.getItem(JWT_STORAGE_KEY));
      setTokenState(stored);
      return stored;
    } finally {
      setIsRestoring(false);
    }
  }, []);

  const setToken = useCallback(async (next: string | null) => {
    if (next) {
      await AsyncStorage.setItem(USER_TOKEN_STORAGE_KEY, next);
      await AsyncStorage.removeItem(JWT_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(USER_TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(JWT_STORAGE_KEY);
    }
    setTokenState(next);
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await api.get('/auth/session');
      const nextUser = extractUser(res.data);

      const status = extractAccountStatus(res.data);
      const mergedUser = nextUser
        ? ({ ...nextUser, status: status ?? (nextUser as any)?.status } as SessionUser)
        : null;

      setUser(mergedUser);
      if (mergedUser) {
        await AsyncStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(mergedUser));
      } else {
        await AsyncStorage.removeItem(SESSION_USER_STORAGE_KEY);
      }

      setUserAccountStatusState(status ?? 'ACTIVE');
      return mergedUser;
    } catch {
      setTokenState(null);
      setUser(null);
      setUserAccountStatusState('ACTIVE');
      await AsyncStorage.removeItem(USER_TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(JWT_STORAGE_KEY);
      await AsyncStorage.removeItem(SESSION_USER_STORAGE_KEY);
      return null;
    }
  }, []);

  const bootstrapAuth = useCallback(async () => {
    setIsRestoring(true);
    try {
      const stored =
        (await AsyncStorage.getItem(USER_TOKEN_STORAGE_KEY)) ??
        (await AsyncStorage.getItem(JWT_STORAGE_KEY));
      const storedUserRaw = await AsyncStorage.getItem(SESSION_USER_STORAGE_KEY);
      const storedUser = storedUserRaw ? (JSON.parse(storedUserRaw) as SessionUser) : null;

      setTokenState(stored);
      setUser(storedUser);
      if (storedUser?.status === 'ACTIVE' || storedUser?.status === 'SUSPENDED') {
        setUserAccountStatusState(storedUser.status);
      } else {
        setUserAccountStatusState('ACTIVE');
      }

      if (stored) {
        await fetchSession();
      }
    } catch {
      setTokenState(null);
      setUser(null);
      setUserAccountStatusState('ACTIVE');
    } finally {
      setIsRestoring(false);
    }
  }, [fetchSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoggingIn(true);
      try {
        const res = await api.post('/auth/login', { email, password });
        const nextToken = extractToken(res.data);
        if (!nextToken) {
          throw new Error('Login succeeded but token was not returned by server.');
        }

        const nextUser = extractUser(res.data);
        const status = extractAccountStatus(res.data);
        const mergedUser = nextUser
          ? ({ ...nextUser, status: status ?? (nextUser as any)?.status } as SessionUser)
          : null;

        await setToken(nextToken);

        setUser(mergedUser);
        if (mergedUser) {
          await AsyncStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(mergedUser));
        } else {
          await AsyncStorage.removeItem(SESSION_USER_STORAGE_KEY);
        }

        if (status) {
          setUserAccountStatusState(status);
        } else {
          setUserAccountStatusState('ACTIVE');
        }

        await fetchSession();
      } finally {
        setIsLoggingIn(false);
      }
    },
    [fetchSession, setToken]
  );

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
    setUserAccountStatusState('ACTIVE');
    await AsyncStorage.removeItem(SESSION_USER_STORAGE_KEY);
  }, [setToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isRestoring,
      isLoggingIn,
      isAuthenticated,
      userAccountStatus,
      isAccountSuspended,
      bootstrapAuth,
      restoreToken,
      setToken,
      login,
      logout,
      fetchSession,
    }),
    [
      token,
      user,
      isRestoring,
      isLoggingIn,
      isAuthenticated,
      userAccountStatus,
      isAccountSuspended,
      bootstrapAuth,
      restoreToken,
      setToken,
      login,
      logout,
      fetchSession,
    ]
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
