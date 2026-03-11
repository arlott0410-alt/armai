import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getBaseUrl } from '../lib/api';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface AuthUser {
  id: string;
  email: string | null;
  role: 'super_admin' | 'merchant_admin';
  merchantIds: string[];
  accessToken: string | null;
}

type AuthState = { user: AuthUser | null; loading: boolean; error: string | null };

const AuthContext = createContext<AuthState & { signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void> }>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  const fetchMe = async (token: string) => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { detail?: string; error?: string }).detail ?? (data as { error?: string }).error ?? 'Session invalid';
      throw new Error(msg);
    }
    return {
      id: data.userId,
      email: data.email,
      role: data.role,
      merchantIds: data.merchantIds ?? [],
      accessToken: token,
    };
  };

  useEffect(() => {
    if (!supabase) {
      setState({ user: null, loading: false, error: null });
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.access_token) {
        setState({ user: null, loading: false, error: null });
        return;
      }
      try {
        const user = await fetchMe(session.access_token);
        setState({ user, loading: false, error: null });
      } catch {
        setState({ user: null, loading: false, error: null });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setState({ user: null, loading: false, error: null });
        return;
      }
      fetchMe(session.access_token)
        .then((user) => setState({ user, loading: false, error: null }))
        .catch(() => setState({ user: null, loading: false, error: null }));
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.session?.access_token) {
      const user = await fetchMe(data.session.access_token);
      setState({ user, loading: false, error: null });
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setState({ user: null, loading: false, error: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
