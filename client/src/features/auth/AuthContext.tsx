import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http, setAuthToken } from "../../api/http";
import type { AuthUser } from "./types";

type LoginArgs = { username: string; password: string };

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  isReady: boolean;
  login: (args: LoginArgs) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const LS_TOKEN = "ip_auth_token";
const LS_USER = "ip_auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(LS_TOKEN);
    const u = localStorage.getItem(LS_USER);
    if (t) setAuthToken(t);
    setToken(t);
    if (u) {
      try {
        setUser(JSON.parse(u) as AuthUser);
      } catch {
        setUser(null);
      }
    }
    setIsReady(true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      isReady,
      login: async ({ username, password }) => {
        const resp = await http.post("/auth/login", { username, password });
        const nextToken: string = resp.data?.data?.token;
        const nextUser: AuthUser = resp.data?.data?.user;
        if (!nextToken || !nextUser) throw new Error("Login failed");
        localStorage.setItem(LS_TOKEN, nextToken);
        localStorage.setItem(LS_USER, JSON.stringify(nextUser));
        setAuthToken(nextToken);
        setToken(nextToken);
        setUser(nextUser);
      },
      logout: () => {
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
        setAuthToken(null);
        setToken(null);
        setUser(null);
      }
    }),
    [token, user, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

