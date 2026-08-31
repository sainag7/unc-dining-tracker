import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database } from './database.types';

/**
 * Server-side client bound to the request's cookies.
 *
 * `cookies()` is async as of Next 16, so this factory is async too — every
 * caller must await it.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies. Harmless here: proxy.ts
            // refreshes the session on every request, so the tokens stay fresh.
          }
        },
      },
    },
  );
});

/**
 * The signed-in user, or null.
 *
 * cache()d, and everything that needs a user goes through it. auth.getUser()
 * is a network call to Supabase Auth — not a local token decode — measured at
 * ~287ms, and it was being made three times per render: once in the
 * middleware, once in the layout, once in the page. Two of those were pure
 * latency. React's cache is per-request, so there is no chance of one user's
 * session being served to another.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
