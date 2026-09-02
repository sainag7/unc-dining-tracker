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
        <p className="text-input font-semibold">Profile not ready</p>
        <p className="mt-2 text-body text-text-muted">
          Reload the page — your profile is created the first time you sign in.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-3 pb-16">
      <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
        <div className="min-w-0">
          <h1 className="wordmark">Settings</h1>
          <p className="mt-1 truncate text-meta text-text-muted">{user.email}</p>
        </div>
        <Link href="/log" className="-mr-3 flex h-11 shrink-0 items-center rounded-full px-3 text-body font-semibold text-accent-text">
          Done
        </Link>
      </div>

      <div className="mt-6">
        <SettingsForm profile={profile} />
      </div>

      <form action={signOut} className="mt-10 border-t border-border pt-4">
        <button
          type="submit"
          className="-ml-1 flex h-11 items-center rounded-full bg-danger-bg px-4 text-body font-semibold text-danger"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
