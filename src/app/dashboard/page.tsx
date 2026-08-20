import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDayLog, getProfile, totalsFor } from '@/lib/log';
import { campusToday, addDays } from '@/lib/dates';
import { DaySummary } from '@/components/day-summary';
import { LogList } from '@/components/log-list';

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function DashboardPage(props: PageProps<'/dashboard'>) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const today = campusToday();
  const raw = searchParams.date;
  const date = (Array.isArray(raw) ? raw[0] : raw) ?? today;

  const [log, profile] = await Promise.all([
    getDayLog(supabase, user.id, date),
    getProfile(supabase, user.id),
  ]);

  return (
    <>
      <header className="border-b border-rule bg-paper-raised px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="signage text-xl text-navy">
            Tray
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-ink-soft hover:text-ink">
              Menu
            </Link>
            <Link href="/history" className="text-ink-soft hover:text-ink">
              History
            </Link>
            <Link href="/settings" className="text-ink-soft hover:text-ink">
              Settings
            </Link>
          </nav>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Link
            href={`/dashboard?date=${addDays(date, -1)}`}
            aria-label="Previous day"
            className="rounded px-2 py-1 text-ink-soft hover:bg-paper-sunk"
          >
            ←
          </Link>
          <h1 className="text-sm font-semibold">
            {date === today ? 'Today' : formatDate(date)}
          </h1>
          <Link
            href={`/dashboard?date=${addDays(date, 1)}`}
            aria-label="Next day"
            className="rounded px-2 py-1 text-ink-soft hover:bg-paper-sunk"
          >
            →
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-12">
        <div className="px-4 pt-4">
          <DaySummary
            totals={totalsFor(log)}
            calorieGoal={profile?.calorie_goal ?? 2000}
            proteinGoal={profile?.protein_goal_g ?? 150}
            carbGoal={profile?.carb_goal_g ?? 250}
            fatGoal={profile?.fat_goal_g ?? 65}
            itemCount={log.length}
          />
        </div>

        <LogList entries={log} />
      </main>
    </>
  );
}
