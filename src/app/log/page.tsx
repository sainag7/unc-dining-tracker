import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getDayLog,
  getProfile,
  getTotalsByDate,
  totalsFor,
  currentStreak,
} from '@/lib/log';
import { campusToday, addDays } from '@/lib/dates';
import { DaySummary } from '@/components/day-summary';
import { WeekStrip } from '@/components/week-strip';
import { LogList } from '@/components/log-list';

const HISTORY_DAYS = 30;

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function LogPage(props: PageProps<'/log'>) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const today = campusToday();
  const raw = searchParams.date;
  const date = (Array.isArray(raw) ? raw[0] : raw) ?? today;

  const [log, profile, totalsByDate] = await Promise.all([
    getDayLog(supabase, user.id, date),
    getProfile(supabase, user.id),
    getTotalsByDate(supabase, user.id, addDays(today, -(HISTORY_DAYS - 1)), today),
  ]);

  const loggedDates = new Set(totalsByDate.keys());
  const streak = currentStreak(loggedDates, today);

  const daysWithEntries = [...totalsByDate.values()];
  const average =
    daysWithEntries.length > 0
      ? Math.round(
          daysWithEntries.reduce((n, t) => n + t.calories, 0) / daysWithEntries.length,
        )
      : 0;

  return (
    <>
      <header className="mx-auto w-full max-w-[640px] px-4 pt-3">
        <div className="flex items-end justify-between gap-3 border-b border-text pb-2">
          <div className="min-w-0">
            <h1 className="wordmark truncate">
              {date === today ? 'Today' : formatDate(date).split(',')[0]}
            </h1>
            <p className="data mt-1 text-meta text-text-muted">{formatDate(date)}</p>
          </div>
          <Link
            href="/settings"
            className="-mr-2 flex h-11 shrink-0 items-center rounded-md px-2 text-body font-medium text-accent-text"
          >
            Settings
          </Link>
        </div>

        <div className="mt-2">
          <WeekStrip selected={date} today={today} loggedDates={loggedDates} />
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-[640px] flex-1 px-4"
        style={{ paddingBottom: 'calc(var(--tab-bar-h) + 2rem)' }}
      >
        <div className="mt-4">
          <DaySummary
            totals={totalsFor(log)}
            calorieGoal={profile?.calorie_goal ?? 2000}
            proteinGoal={profile?.protein_goal_g ?? 150}
            carbGoal={profile?.carb_goal_g ?? 250}
            fatGoal={profile?.fat_goal_g ?? 65}
          />
        </div>

        {daysWithEntries.length > 0 && (
          <p className="mt-3 border-t border-border pt-2 text-meta text-text-muted">
            <span className="data font-semibold text-text">{streak}</span>
            {streak === 1 ? ' day streak' : ' day streak'}
            <span className="mx-2">·</span>
            <span className="data font-semibold text-text">
              {average.toLocaleString()}
            </span>{' '}
            cal average over {daysWithEntries.length}{' '}
            {daysWithEntries.length === 1 ? 'day' : 'days'}
          </p>
        )}

        <LogList entries={log} />
      </main>
    </>
  );
}
