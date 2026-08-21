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
        <p className="signage text-lg">Profile not ready</p>
        <p className="mt-2 text-sm text-ink-soft">
          Reload the page — your profile is created the first time you sign in.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-3 pb-16">
      <div className="flex items-end justify-between gap-3 border-b-2 border-rule-strong pb-1.5">
        <div className="min-w-0">
          <h1 className="signage text-[2rem] leading-none">Settings</h1>
          <p className="mt-1 truncate text-xs text-ink-soft">{user.email}</p>
        </div>
        <Link href="/log" className="shrink-0 pb-0.5 text-xs text-carolina">
          Done
        </Link>
      </div>

      <div className="mt-6">
        <SettingsForm profile={profile} />
      </div>

      <form action={signOut} className="mt-10 border-t border-rule pt-4">
        <button
          type="submit"
          className="text-sm text-danger underline underline-offset-2"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
