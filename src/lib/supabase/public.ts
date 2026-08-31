import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * A client with no cookies attached, for reading data that belongs to nobody.
 *
 * The menu is public — every one of its tables carries `for select using
 * (true)` in migration 0001 — and it changes once a day, when the scraper cron
 * runs. That makes it the one thing in this app worth caching, and caching is
 * why this client has to exist: `unstable_cache` cannot contain a `cookies()`
 * call, and the normal server client (`server.ts`) is built from cookies by
 * definition.
 *
 * Uses the anon key, not the service role. The anon key is already shipped to
 * every browser, and RLS still applies to it, so nothing here can read more
 * than a signed-out visitor could. Caching behind a key that *bypasses* RLS is
 * how a cache entry ends up holding one user's private row and serving it to
 * everyone — the admin client stays out of read paths for that reason.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
