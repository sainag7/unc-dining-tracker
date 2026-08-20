import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Service-role client — bypasses RLS, so it is the only thing that can write
 * menu data. Used by the cron route and by scripts/ CLI tooling.
 *
 * SUPABASE_SERVICE_ROLE_KEY deliberately has no NEXT_PUBLIC_ prefix, so Next
 * will not bundle it into client code. Never import this module from a
 * component that runs in the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — see .env.example',
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
