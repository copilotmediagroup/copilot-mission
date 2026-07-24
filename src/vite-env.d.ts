/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ADDRESS_BIAS_LAT?: string
  readonly VITE_ADDRESS_BIAS_LON?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
