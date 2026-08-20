import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/log';
import { SettingsForm } from '@/components/settings-form';
import { signOut } from './actions';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const profile = await getProfile(supabase, user.id);

  if (!profile) {
    return (
      <main className="flex-1 px-6 py-20 text-center">
        <p className="signage text-xl">Profile not ready</p>
        <p className="mt-2 text-sm text-ink-soft">
          Reload the page — your profile is created the first time you sign in.
        </p>
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-rule bg-paper-raised px-4 pt-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="signage text-xl text-navy">
            Tray
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-ink-soft hover:text-ink">
              Menu
            </Link>
            <Link href="/dashboard" className="text-ink-soft hover:text-ink">
              Today
            </Link>
            <Link href="/history" className="text-ink-soft hover:text-ink">
              History
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <h1 className="signage text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">{user.email}</p>

        <div className="mt-6">
          <SettingsForm profile={profile} />
        </div>

        <form action={signOut} className="mt-10 border-t border-rule pt-6">
          <button type="submit" className="text-sm font-medium text-danger underline">
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
