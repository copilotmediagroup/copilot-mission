import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { backendMode, supabase } from '../../lib/supabase'

export type AppRole = 'platform_admin' | 'agency_admin' | 'guard' | 'client'
export type AccountStatus = 'pending' | 'approved' | 'disabled' | 'rejected'
export type AuthPhase = 'booting' | 'signed_out' | 'profile_loading' | 'ready' | 'profile_missing' | 'connection_error'
export type AppProfile = { id: string; role: AppRole; account_status: AccountStatus; full_name: string | null }

type AuthState = {
  phase: AuthPhase; session: Session | null; user: User | null; profile: AppProfile | null
  role: AppRole | null; status: AccountStatus | null; mode: 'supabase' | 'unconfigured'; error: string | null
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (input: { email: string; password: string; fullName: string; accountType: 'client' | 'agency_admin'; agencyName?: string }) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>; retry: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function clearTransientAppState() {
  sessionStorage.clear()
  localStorage.removeItem('co-pilot-demo-role')
  localStorage.removeItem('co-pilot-developer-mode')
  localStorage.removeItem('co-pilot-marketplace-state')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>('booting')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const signingOut = useRef(false)

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!mounted.current || signingOut.current) return
    setSession(nextSession)
    setError(null)

    if (!nextSession?.user) {
      setProfile(null)
      setPhase('signed_out')
      return
    }

    if (!supabase) {
      setProfile(null)
      setError('Supabase is not configured.')
      setPhase('connection_error')
      return
    }

    setPhase('profile_loading')
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id,role,account_status,full_name')
      .eq('id', nextSession.user.id)
      .maybeSingle()

    if (!mounted.current || signingOut.current) return
    if (profileError) {
      setProfile(null)
      setError(profileError.message)
      setPhase('connection_error')
      return
    }
    if (!data) {
      setProfile(null)
      setPhase('profile_missing')
      return
    }

    setProfile(data as AppProfile)
    setPhase('ready')
  }, [])

  const initialize = useCallback(async () => {
    signingOut.current = false
    setProfile(null)
    setSession(null)
    setError(null)
    setPhase('booting')

    if (!supabase) {
      setError('Supabase is not configured.')
      setPhase('connection_error')
      return
    }

    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Session check timed out.')), 12000)),
      ])
      await loadProfile(result.data.session)
    } catch (cause) {
      if (!mounted.current) return
      setError(cause instanceof Error ? cause.message : 'Unable to reach Co Pilot.')
      setPhase('connection_error')
    }
  }, [loadProfile])

  useEffect(() => {
    mounted.current = true
    void initialize()

    if (!supabase) return () => { mounted.current = false }

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (signingOut.current) return
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        setError(null)
        setPhase('signed_out')
        return
      }
      if (event === 'INITIAL_SESSION') return
      window.setTimeout(() => void loadProfile(nextSession), 0)
    })

    return () => {
      mounted.current = false
      data.subscription.unsubscribe()
    }
  }, [initialize, loadProfile])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: null }
    signingOut.current = false
    setPhase('booting')
    setError(null)
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) setPhase('signed_out')
    else await loadProfile(result.data.session)
    return { error: result.error }
  }

  const signUp: AuthState['signUp'] = async ({ email, password, fullName, accountType, agencyName }) => {
    if (!supabase) return { error: null, needsEmailConfirmation: false }
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, account_type: accountType, agency_name: agencyName ?? null } },
    })
    if (result.data.session) await loadProfile(result.data.session)
    return { error: result.error, needsEmailConfirmation: !result.data.session && Boolean(result.data.user) }
  }

  const signOut = async () => {
    if (signingOut.current) return
    signingOut.current = true

    // Fail closed immediately: protected content is removed before the network call.
    setProfile(null)
    setSession(null)
    setError(null)
    setPhase('signed_out')
    clearTransientAppState()

    try {
      if (supabase) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signOutError) console.warn('Supabase sign out warning:', signOutError.message)
      }
    } finally {
      // A hard navigation guarantees React, subscriptions and browser history
      // cannot revive a stale protected workspace.
      window.history.replaceState(null, '', '/')
      window.location.replace('/')
    }
  }

  const value = useMemo<AuthState>(() => ({
    phase,
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    status: profile?.account_status ?? null,
    mode: backendMode,
    error,
    signIn,
    signUp,
    signOut,
    retry: initialize,
  }), [phase, session, profile, error, initialize])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
