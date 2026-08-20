'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'verify';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'signin') {
      return withBusy(async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      });
    }

    if (mode === 'signup') {
      return withBusy(async () => {
        if (password.length < 8) {
          throw new Error('Password needs to be at least 8 characters.');
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMode('verify');
        setNotice(`We sent a 6-digit code to ${email}.`);
      });
    }

    return withBusy(async () => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'signup',
      });
      if (error) throw error;
      router.push('/');
      router.refresh();
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <Link href="/" className="signage mb-1 text-3xl text-navy">
        Tray
      </Link>
      <p className="mb-8 text-sm text-ink-soft">
        {mode === 'verify'
          ? 'Check your email for the code.'
          : 'Track what you eat at Chase and Lenoir.'}
      </p>

      {mode !== 'verify' && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full rounded-xl border border-rule bg-paper-raised py-3 text-sm font-semibold disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-faint">
            <span className="h-px flex-1 bg-rule" />
            or
            <span className="h-px flex-1 bg-rule" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'verify' ? (
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium">
              Verification code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="123456"
              className="data w-full rounded-lg border border-rule bg-paper-raised px-3 py-2.5 text-lg tracking-[0.3em]"
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
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
                className="w-full rounded-lg border border-rule bg-paper-raised px-3 py-2.5"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-rule bg-paper-raised px-3 py-2.5"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-ink-soft">At least 8 characters.</p>
              )}
            </div>
          </>
        )}

        {notice && <p className="text-sm text-ink-soft">{notice}</p>}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-navy py-3 text-sm font-semibold text-paper-raised disabled:opacity-60"
        >
          {busy
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Verify and continue'}
        </button>
      </form>

      {mode !== 'verify' && (
        <p className="mt-5 text-center text-sm text-ink-soft">
          {mode === 'signin' ? "Don't have an account?" : 'Already have one?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
            className="font-semibold text-carolina underline"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      )}

      <Link href="/" className="mt-8 text-center text-sm text-ink-soft underline">
        Browse the menu without an account
      </Link>
    </main>
  );
}
