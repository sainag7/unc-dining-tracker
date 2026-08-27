import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Finishes every link-based sign-in: Google OAuth and the confirmation email.
 *
 * Two link shapes land here.
 *   ?code=…                — OAuth, and email links after Supabase has already
 *                            checked the token on its own /auth/v1/verify
 *                            endpoint. This is what the stock email templates
 *                            send, so it's the one that matters today.
 *   ?token_hash=…&type=…   — the shape Supabase recommends once you edit the
 *                            templates yourself. Handled too, so switching to a
 *                            custom template later needs no code change.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  // Supabase reports expired or already-used links with these params.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) return fail(providerError);

  // Only ever redirect to a path on this origin.
  const requested = searchParams.get('next') ?? '/';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  const supabase = await createClient();

  const code = searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // The PKCE verifier lives in a cookie set when sign-in started, so a link
    // opened in a different browser than it was requested from can't complete.
    return fail('That link has to be opened in the same browser you signed up in.');
  }

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return fail('That link has expired. Request a new one.');
  }

  return fail('That sign-in link was incomplete. Request a new one.');
}
