import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase only honours the `redirect_to` we ask for when it matches an entry in
 * the project's Redirect URLs allow list. When it doesn't, Supabase quietly
 * substitutes the Site URL and hangs the OAuth code off *that* instead — so the
 * code lands on `/` and the menu renders signed out, with nothing on screen to
 * say why. Sending the stray params on to `/auth/callback` finishes the sign-in
 * anyway: the PKCE verifier cookie is still in the browser at this point, so the
 * code is still redeemable.
 *
 * Returns a redirect when there is something to rescue, otherwise null.
 */
function rescueAuthParams(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // A provider failure lands the same way. Surface it on /login rather than
  // letting the menu swallow it.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError && pathname !== '/login' && pathname !== '/auth/callback') {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', providerError);
    return NextResponse.redirect(url);
  }

  const code = searchParams.get('code');
  if (!code || pathname === '/auth/callback') return null;

  const url = new URL('/auth/callback', request.url);
  url.searchParams.set('code', code);
  // Resume where sign-in was meant to land. The callback re-checks that this is
  // a path on this origin before redirecting to it.
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

/**
 * Keeps the Supabase session fresh.
 *
 * Named `proxy` rather than `middleware`: Next 16 renamed the convention, and
 * the file must be `src/proxy.ts` with a `proxy` export.
 *
 * This only refreshes tokens — it deliberately does not gate any routes.
 * Menu browsing works signed out, and the pages that do need a user check for
 * one themselves.
 */
export async function proxy(request: NextRequest) {
  const misrouted = rescueAuthParams(request);
  if (misrouted) return misrouted;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touching getUser() is what triggers the refresh; the result is unused here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never need a
     * session and shouldn't pay for a refresh round-trip.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
