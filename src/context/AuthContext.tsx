import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiJson, apiRequest } from "../utils/apiClient.js";
import { SESSION_EXPIRED_EVENT, setFetchSession } from "../utils/authFetch.js";

export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  must_change_password: boolean;
  created_at: string;
};
type SessionResponse = { user: AuthUser; csrf_token: string };
type MeResponse = SessionResponse | { user: null; csrf_token: null; auth_enabled: false };
type AuthState = {
  user: AuthUser | null;
  authEnabled: boolean;
  loading: boolean;
  signOutFailed: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signOutFailed, setSignOutFailed] = useState(false);
  const revision = useRef(0);
  const accept = useCallback((data: SessionResponse) => {
    setFetchSession(data.csrf_token);
    setUser(data.user);
    setAuthEnabled(true);
    setSignOutFailed(false);
    setError("");
  }, []);
  const clear = useCallback(() => {
    revision.current++;
    setFetchSession(null);
    setUser(null);
    setSignOutFailed(false);
  }, []);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true);
    try {
      const data = await apiRequest<MeResponse>("/api/auth/me");
      if (current === revision.current) {
        if ("auth_enabled" in data && data.auth_enabled === false) { setAuthEnabled(false); setFetchSession(null, false); setUser(null); setError(""); }
        else { setAuthEnabled(true); accept(data); }
      }
    } catch (err) {
      if (current === revision.current) {
        setFetchSession(null);
        setUser(null);
        setAuthEnabled(true);
        setError(err instanceof Error && !("status" in err && err.status === 401) ? err.message : "");
      }
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, [accept, clear]);
  useEffect(() => {
    const expired = () => {
      clear();
      setLoading(false);
      setError("Your session has expired. Please sign in again.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    void refresh();
    return () => { revision.current++; window.removeEventListener(SESSION_EXPIRED_EVENT, expired); };
  }, [clear, refresh]);
  const login = useCallback(async (email: string, password: string) => {
    const current = ++revision.current;
    const data = await apiJson<SessionResponse>("/api/auth/login", { email, password });
    if (current === revision.current) accept(data);
  }, [accept]);
  const logout = useCallback(async () => {
    // Unmount private workspace state immediately, retaining CSRF only in memory until
    // revocation succeeds so a network failure can safely be retried.
    const current = ++revision.current;
    const pending = apiJson("/api/auth/logout", {});
    setUser(null);
    setLoading(true);
    setError("");
    try {
      await pending;
      if (current === revision.current) { setFetchSession(null); setSignOutFailed(false); }
    } catch {
      if (current === revision.current) {
        setSignOutFailed(true);
        setError("Sign-out could not be confirmed. Retry before leaving a shared device.");
      }
    } finally { if (current === revision.current) setLoading(false); }
  }, []);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = revision.current;
    const data = await apiJson<SessionResponse>("/api/auth/password", { current_password: currentPassword, new_password: newPassword });
    if (current === revision.current) accept(data);
  }, [accept]);
  const value = useMemo(() => ({ user, authEnabled, loading, signOutFailed, error, login, logout, changePassword, refresh }), [user, authEnabled, loading, signOutFailed, error, login, logout, changePassword, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
