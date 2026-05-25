import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** URL Supabase — priorité aux variables Vercel (Settings → Environment Variables). */
export const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL as string | undefined
)?.trim() ?? '';

export const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
)?.trim() ?? '';

export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.length > 0 &&
    SUPABASE_ANON_KEY.length > 0 &&
    SUPABASE_URL.includes('supabase.co')
  );
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/** @deprecated Préférer getSupabase() — peut être null si Supabase non configuré. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    if (!c) return undefined;
    return (c as unknown as Record<string | symbol, unknown>)[prop];
  },
});
