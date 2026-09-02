import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { campusToday } from '@/lib/dates';
import { LoginForm } from '@/components/login-form';

/** "Wed, Aug 26" — a menu is always a menu for a given day. */
function boardDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Confirming an email link signs you in, so landing back here means the
  // session already took — nothing left to do on this page.
  if (user) redirect('/');

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <Link href="/" className="wordmark">
          Tray
        </Link>
        <span className="data text-meta text-text-muted">{boardDate(campusToday())}</span>
      </div>

      <LoginForm initialError={error ?? null} />
    </main>
  );
}
