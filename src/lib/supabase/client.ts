import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Browser client. Safe to use anywhere in the app — it only ever holds the
 * anon key, and RLS is what actually protects user rows.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
