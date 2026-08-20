import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTotalsByDate, getProfile, currentStreak } from '@/lib/log';
import { campusToday, addDays } from '@/lib/dates';

const WINDOW_DAYS = 30;

function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function weekday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'narrow',
    timeZone: 'UTC',
  });
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const today = campusToday();
  const from = addDays(today, -(WINDOW_DAYS - 1));

  const [totalsByDate, profile] = await Promise.all([
    getTotalsByDate(supabase, user.id, from, today),
    getProfile(supabase, user.id),
  ]);

  const goal = profile?.calorie_goal ?? 2000;
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(from, i));
  const logged = days.filter((d) => totalsByDate.has(d));

  const streak = currentStreak(new Set(totalsByDate.keys()), today);
  const average =
    logged.length > 0
      ? Math.round(
          logged.reduce((n, d) => n + (totalsByDate.get(d)?.calories ?? 0), 0) / logged.length,
        )
      : 0;
  const averageProtein =
    logged.length > 0
      ? Math.round(
          logged.reduce((n, d) => n + (totalsByDate.get(d)?.protein ?? 0), 0) / logged.length,
        )
      : 0;

  // Scale bars against the taller of the goal or the biggest day, so an
  // over-goal day still fits inside the chart.
  const peak = Math.max(goal, ...days.map((d) => totalsByDate.get(d)?.calories ?? 0));

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
            <Link href="/settings" className="text-ink-soft hover:text-ink">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 pb-12 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Day streak', value: streak, suffix: '' },
            { label: 'Avg calories', value: average, suffix: '' },
            { label: 'Avg protein', value: averageProtein, suffix: 'g' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-2 border-rule-strong bg-paper-raised px-3 py-2"
            >
              <span className="data block text-2xl font-semibold leading-none">
                {stat.value}
                {stat.suffix}
              </span>
              <span className="mt-1 block text-[11px] uppercase tracking-wide text-ink-soft">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <section className="mt-6">
          <div className="flex items-baseline justify-between border-b-2 border-rule-strong pb-1">
            <h2 className="signage text-lg">Last 30 days</h2>
            <span className="data text-xs text-ink-soft">goal {goal}</span>
          </div>

          {logged.length === 0 ? (
            <div className="py-14 text-center">
              <p className="signage text-xl text-ink-soft">No history yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
                Log a few meals and your daily totals will chart here.
              </p>
            </div>
          ) : (
            <>
              {/* Bars are links, so any day in the chart opens that day's log. */}
              <div className="mt-4 flex h-40 items-end gap-[3px]">
                {days.map((date) => {
                  const totals = totalsByDate.get(date);
                  const calories = totals?.calories ?? 0;
                  const height = peak > 0 ? (calories / peak) * 100 : 0;
                  const over = calories > goal;

                  return (
                    <Link
                      key={date}
                      href={`/dashboard?date=${date}`}
                      title={`${shortDate(date)} — ${calories} cal`}
                      className="group relative flex h-full flex-1 items-end"
                    >
                      <span
                        className={`w-full rounded-t-sm ${
                          calories === 0
                            ? 'bg-paper-sunk'
                            : over
                              ? 'bg-serving'
                              : 'bg-carolina'
                        } group-hover:opacity-80`}
                        style={{ height: calories === 0 ? '2px' : `${Math.max(height, 2)}%` }}
                      />
                    </Link>
                  );
                })}
              </div>

              {/* Goal line sits under the bars as a reference, not a judgement. */}
              <div className="mt-1 flex gap-[3px]">
                {days.map((date) => (
                  <span
                    key={date}
                    className="flex-1 text-center text-[9px] text-ink-faint"
                    aria-hidden
                  >
                    {weekday(date)}
                  </span>
                ))}
              </div>

              <ul className="mt-6">
                {[...logged].reverse().map((date) => {
                  const totals = totalsByDate.get(date)!;
                  return (
                    <li key={date}>
                      <Link
                        href={`/dashboard?date=${date}`}
                        className="flex items-center justify-between border-b border-rule py-2.5 hover:bg-paper-sunk"
                      >
                        <span className="text-[15px]">
                          {date === today ? 'Today' : shortDate(date)}
                        </span>
                        <span className="data text-sm">
                          {totals.calories} cal
                          <span className="ml-2 text-ink-faint">{totals.protein}g P</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
    </>
  );
}
