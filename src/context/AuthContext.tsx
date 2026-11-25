import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User } from '../types';
import {
  loginUser,
  registerUser,
  claimAdminAccount,
  loginAdmin,
  fetchCurrentUser,
} from '../lib/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  authModalMode: 'login' | 'register' | null;
  openAuthModal: (mode: 'login' | 'register') => void;
  closeAuthModal: () => void;
  signIn: (identifier: string, password: string) => Promise<User>;
  signUp: (username: string, email: string, password: string) => Promise<User>;
  claimAdmin: (username: string, email: string, password: string) => Promise<User>;
  signInAdmin: (payload: {
    passcode?: string;
    identifier?: string;
    password?: string;
  }) => Promise<User>;
  signOut: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Token and user stay strictly in React memory (never persisted to localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);

  const openAuthModal = useCallback((mode: 'login' | 'register') => {
    setAuthModalMode(mode);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalMode(null);
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const res = await loginUser({ identifier, password });
    setToken(res.token);
    setUser(res.user);
    setAuthModalMode(null);
    return res.user;
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string) => {
    const res = await registerUser({ username, email, password });
    setToken(res.token);
    setUser(res.user);
    setAuthModalMode(null);
    return res.user;
  }, []);

  const claimAdmin = useCallback(async (username: string, email: string, password: string) => {
    const res = await claimAdminAccount({ username, email, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const signInAdmin = useCallback(
    async (payload: { passcode?: string; identifier?: string; password?: string }) => {
      const res = await loginAdmin(payload, token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    },
    [token]
  );

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const res = await fetchCurrentUser(token);
    setUser(res.user);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        signIn,
        signUp,
        claimAdmin,
        signInAdmin,
        signOut,
        setUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
