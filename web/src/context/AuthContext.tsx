import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onApiStatus, setToken, getToken } from '../lib/api';
import type { PageId } from '../lib/pages';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  active: boolean;
  permissions: PageId[];
  document: string;
  phone: string;
  currentCompanyId: number | null;
  createdAt: string;
}

export interface AccessInfo {
  hasAccess: boolean;
  requireSubscription: boolean;
  state: 'active' | 'grace' | 'expired' | 'pending' | 'none';
  periodEnd: string | null;
  planName: string | null;
}

interface Session {
  user: SessionUser;
  access: AccessInfo;
}

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(data: { name: string; email: string; password: string; document?: string }): Promise<void>;
  logout(): void;
  refresh(): Promise<void>;
  setSession(s: Session): void;
  can(page: PageId): boolean;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setSession(null);
      return;
    }
    try {
      setSession(await api<Session>('/auth/me'));
    } catch {
      setToken(null);
      setSession(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(
    () =>
      onApiStatus((status) => {
        if (status === 401) {
          setToken(null);
          setSession(null);
        } else if (status === 402) {
          refresh();
        }
      }),
    [refresh],
  );

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<Session & { token: string }>('/auth/login', { body: { email, password } });
    setToken(r.token);
    setSession({ user: r.user, access: r.access });
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string; document?: string }) => {
    const r = await api<Session & { token: string }>('/auth/register', { body: data });
    setToken(r.token);
    setSession({ user: r.user, access: r.access });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      loading,
      login,
      register,
      logout,
      refresh,
      setSession,
      isAdmin: session?.user.role === 'admin',
      can: (page) => Boolean(session && (session.user.role === 'admin' || session.user.permissions.includes(page))),
    }),
    [session, loading, login, register, logout, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return c;
}
