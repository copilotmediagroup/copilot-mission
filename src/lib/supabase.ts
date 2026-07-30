import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Vite normally reads these values from .env. The publishable fallback keeps
// GitHub/Bolt imports connected even when a hidden .env file is not copied.
const url = (import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://eznhyemkuxectndxtymc.supabase.co')
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_hH7L_QevzMnpKaXEpIcLiA_vWMTEj21')

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'co-pilot-security-auth',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

export type BackendMode = 'supabase' | 'unconfigured'
export const backendMode: BackendMode = isSupabaseConfigured ? 'supabase' : 'unconfigured'
