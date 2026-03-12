import React, { createContext, useContext, useEffect, useState } from 'react'
import { getBaseUrl } from '../lib/api'
import { getSupabase } from '../lib/supabase'

export interface SignUpResult {
  needsConfirmation?: boolean
  email?: string
}

export interface AuthUser {
  id: string
  email: string | null
  role: 'super_admin' | 'merchant_admin'
  merchantIds: string[]
  accessToken: string | null
}

type AuthState = { user: AuthUser | null; loading: boolean; error: string | null }

const AuthContext = createContext<
  AuthState & {
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string) => Promise<SignUpResult>
    resendConfirmation: (email: string) => Promise<void>
    signOut: () => Promise<void>
    /** Refetch /auth/me and update state (e.g. after onboard). */
    refreshUser: () => Promise<void>
  }
>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null })

  const fetchMe = async (token: string) => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        (data as { detail?: string; error?: string }).detail ??
        (data as { error?: string }).error ??
        'Session invalid'
      throw new Error(msg)
    }
    return {
      id: data.userId,
      email: data.email,
      role: data.role,
      merchantIds: data.merchantIds ?? [],
      accessToken: token,
    }
  }

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setState({ user: null, loading: false, error: null })
      return
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.access_token) {
        setState({ user: null, loading: false, error: null })
        return
      }
      try {
        const user = await fetchMe(session.access_token)
        setState({ user, loading: false, error: null })
      } catch {
        setState({ user: null, loading: false, error: null })
      }
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setState({ user: null, loading: false, error: null })
        return
      }
      fetchMe(session.access_token)
        .then((user) => setState({ user, loading: false, error: null }))
        .catch(() => setState({ user: null, loading: false, error: null }))
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (data.session?.access_token) {
      const user = await fetchMe(data.session.access_token)
      setState({ user, loading: false, error: null })
    }
  }

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      if (
        error.message?.toLowerCase().includes('already registered') ||
        error.code === 'user_already_exists'
      ) {
        throw new Error('Email already registered. Sign in or use another email.')
      }
      throw new Error(error.message)
    }
    if (data.session?.access_token) {
      const token = data.session.access_token
      const base = getBaseUrl()
      const onboardRes = await fetch(`${base}/onboard/merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const onboardData = await onboardRes.json().catch(() => ({}))
      if (!onboardRes.ok) {
        const msg = (onboardData as { error?: string }).error ?? 'Onboard failed'
        throw new Error(msg)
      }
      const user = await fetchMe(token)
      setState({ user, loading: false, error: null })
      return {}
    }
    return { needsConfirmation: true, email: data.user?.email ?? email }
  }

  const resendConfirmation = async (email: string) => {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    const supabase = getSupabase()
    if (supabase) await supabase.auth.signOut()
    setState({ user: null, loading: false, error: null })
  }

  const refreshUser = async () => {
    const supabase = getSupabase()
    if (!supabase) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return
    try {
      const user = await fetchMe(session.access_token)
      setState((s) => ({ ...s, user, loading: false, error: null }))
    } catch {
      setState((s) => ({ ...s, user: null, loading: false, error: null }))
    }
  }

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, resendConfirmation, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
