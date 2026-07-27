import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ixqprtabkyurqlqskjxi.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_d88iu_TjwufU-ZJxrQ5FFw_bPwEpiYC';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key);
export const isSupabaseConfigured = true;
