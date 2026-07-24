import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { backendMode, supabase } from '../../lib/supabase'

export type AppRole = 'platform_admin' | 'agency_admin' | 'guard' | 'client'

type AuthState = {
  loading: boolean
  session: Session | null
  user: User | null
  role: AppRole | null
  mode: 'supabase' | 'mock'
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<AppRole | null>(backendMode === 'mock' ? 'agency_admin' : null)
  const [loading, setLoading] = useState(backendMode === 'supabase')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session?.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle()
        if (active) setRole((profile?.role as AppRole | undefined) ?? null)
      }
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession?.user) setRole(null)
      else {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', nextSession.user.id).maybeSingle()
        setRole((profile?.role as AppRole | undefined) ?? null)
      }
      setLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthState>(() => ({
    loading,
    session,
    user: session?.user ?? null,
    role,
    mode: backendMode,
    signOut: async () => { if (supabase) await supabase.auth.signOut() },
  }), [loading, session, role])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
