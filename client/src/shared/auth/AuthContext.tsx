/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { decodeJwt, isJwtExpired } from "./token";
import type { AuthUser } from "./authTypes";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
};

type AuthContextValue = AuthState & {
  setToken: (token: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "has.token";

function parseUserFromToken(token: string | null): AuthUser | null {
  if (!token) return null;
  if (isJwtExpired(token)) return null;
  const payload = decodeJwt(token);
  if (!payload?.id || !payload?.role) return null;
  return { id: payload.id, role: payload.role, name: payload.name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<AuthUser | null>(() =>
    parseUserFromToken(token),
  );

  const setToken = useCallback((next: string | null) => {
    setTokenState(next);
    setUser(parseUserFromToken(next));
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const logout = useCallback(() => setToken(null), [setToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, setToken, logout }),
    [token, user, setToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
