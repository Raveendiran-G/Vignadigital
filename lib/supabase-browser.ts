import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let c: SupabaseClient | null | undefined;

/** Anon client used ONLY for Realtime broadcast pings. All data goes through API routes. */
export function supabaseBrowser(): SupabaseClient | null {
  if (c !== undefined) return c;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  c = url && anon ? createClient(url, anon) : null;
  return c;
}
