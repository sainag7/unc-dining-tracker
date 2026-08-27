'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'sent';

export function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The message is already on screen; drop it from the URL so a refresh doesn't
  // resurrect a failure the user has moved on from.
  useEffect(() => {
    if (!initialError) return;
    window.history.replaceState(null, '', window.location.pathname);
  }, [initialError]);

  /** Where every email and OAuth link comes back to. */
  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const signInWithGoogle = () =>
    withBusy(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl() },
      });
      if (error) throw error;
    });

  const resendConfirmation = () =>
    withBusy(async () => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;
      setNotice(`Sent another link to ${email}.`);
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'signin') {
      return withBusy(async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Supabase phrases this one as "Email not confirmed", which doesn't
          // tell anyone what to do about it.
          if (error.message.toLowerCase().includes('not confirmed')) {
            setMode('sent');
            setNotice(`Confirm your email first — check ${email} for the link.`);
            return;
          }
          throw error;
        }
        router.push('/');
        router.refresh();
      });
    }

    return withBusy(async () => {
      if (password.length < 8) {
        throw new Error('Password needs to be at least 8 characters.');
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;

      // With email confirmation switched off, signUp hands back a live session
      // and there's nothing to wait for.
      if (data.session) {
        router.push('/');
        router.refresh();
        return;
      }

      setMode('sent');
      setNotice(null);
    });
  };

  if (mode === 'sent') {
    return (
      <section className="mt-7 border-t border-border pt-4">
        <h2 className="placard mb-2.5 text-text-muted">Check your email</h2>

        <p className="text-input">
          We sent a confirmation link to <span className="font-semibold">{email}</span>. Open it in
          this browser and you&rsquo;ll be signed in.
        </p>
        <p className="mt-3 text-body text-text-muted">
          Nothing yet? It can take a minute, and it sometimes lands in spam.
        </p>

        {notice && <p className="mt-4 text-body text-text-muted">{notice}</p>}
        {error && (
          <p role="alert" className="mt-4 text-body font-medium text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={resendConfirmation}
          disabled={busy}
          className="mt-6 h-12 w-full rounded-md border border-border-strong text-input font-medium disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Resend link'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setError(null);
            setNotice(null);
          }}
          className="-ml-2 mt-4 flex h-11 items-center rounded-md px-2 text-body font-medium text-accent-text"
        >
          Back to sign in
        </button>
      </section>
    );
  }

  return (
    <>
      <p className="mt-5 text-body text-text-muted">Track what you eat at Chase and Lenoir.</p>

      {/*
        Two ways in, set as two ruled rows. A centred "or" lozenge between them
        would be ornament; the section labels already say they're alternatives,
        and the second one names what it actually does in this mode.
      */}
      <section className="mt-7 border-t border-border pt-4">
        <h2 className="placard mb-2.5 text-text-muted">Campus account</h2>
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="h-12 w-full rounded-md border border-border-strong text-input font-medium disabled:opacity-50"
        >
          {busy ? 'Continuing…' : 'Continue with Google'}
        </button>
      </section>

      <section className="mt-6 border-t border-border pt-4">
        <h2 className="placard mb-3 text-text-muted">
          {mode === 'signin' ? 'Or with a password' : 'Create an account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-body font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@unc.edu"
              className="field-underline w-full text-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-body font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="field-underline w-full text-input"
            />
            {mode === 'signup' && (
              <p className="mt-1 text-meta text-text-muted">At least 8 characters.</p>
            )}
          </div>

          {notice && <p className="text-body text-text-muted">{notice}</p>}
          {error && (
            <p role="alert" className="text-body font-medium text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="on-accent h-12 w-full rounded-md bg-accent text-input font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy
              ? mode === 'signin'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-body text-text-muted">
          {mode === 'signin' ? "Don't have an account?" : 'Already have one?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
            className="font-semibold text-accent-text underline underline-offset-2"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </section>

      <Link
        href="/"
        className="mt-6 flex h-11 items-center border-t border-border text-body font-medium text-accent-text"
      >
        Browse the menu without an account
      </Link>
    </>
  );
}
