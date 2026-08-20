import Link from 'next/link';
import type { DiningHallRow } from '@/lib/supabase/database.types';
import type { MealPeriodSummary } from '@/lib/menu';
import { addDays } from '@/lib/dates';

function buildHref(params: { hall: string; date: string; period?: string }) {
  const search = new URLSearchParams({ hall: params.hall, date: params.date });
  if (params.period) search.set('period', params.period);
  return `/?${search.toString()}`;
}

/** Formats "2026-08-20" as "Thu, Aug 20" without dragging the date into local time. */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function TopNav({
  halls,
  currentHall,
  date,
  today,
  periods,
  currentPeriod,
  servingNowPeriod,
}: {
  halls: DiningHallRow[];
  currentHall: string;
  date: string;
  today: string;
  periods: MealPeriodSummary[];
  currentPeriod: string | null;
  servingNowPeriod: string | null;
}) {
  return (
    <header className="border-b border-rule bg-paper-raised">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <Link href="/" className="signage text-xl leading-none text-navy">
          Tray
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-ink-soft hover:text-ink">
            Today
          </Link>
          <Link href="/history" className="text-ink-soft hover:text-ink">
            History
          </Link>
          <Link href="/settings" className="text-ink-soft hover:text-ink">
            Settings
          </Link>
        </nav>
      </div>

      {/* Hall choice is the first decision, so it reads as a physical switch. */}
      <div className="mt-3 flex gap-1 px-4">
        {halls.map((hall) => {
          const active = hall.slug === currentHall;
          return (
            <Link
              key={hall.id}
              href={buildHref({ hall: hall.slug, date })}
              aria-current={active ? 'page' : undefined}
              className={`signage flex-1 rounded-t-lg border border-b-0 px-3 py-2 text-center text-sm ${
                active
                  ? 'border-rule-strong bg-navy text-paper-raised'
                  : 'border-rule bg-paper text-ink-soft'
              }`}
            >
              {hall.name.replace(' Dining Hall', '')}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-y border-rule bg-paper px-4 py-1.5">
        <Link
          href={buildHref({ hall: currentHall, date: addDays(date, -1) })}
          aria-label="Previous day"
          className="rounded px-2 py-1 text-ink-soft hover:bg-paper-sunk"
        >
          ←
        </Link>
        <span className="text-sm font-semibold">
          {date === today ? 'Today' : formatDate(date)}
          {date !== today && (
            <Link
              href={buildHref({ hall: currentHall, date: today })}
              className="ml-2 font-normal text-carolina underline"
            >
              back to today
            </Link>
          )}
        </span>
        <Link
          href={buildHref({ hall: currentHall, date: addDays(date, 1) })}
          aria-label="Next day"
          className="rounded px-2 py-1 text-ink-soft hover:bg-paper-sunk"
        >
          →
        </Link>
      </div>

      {periods.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-2">
          {periods.map((period) => {
            const active = period.name === currentPeriod;
            const servingNow = period.name === servingNowPeriod;
            return (
              <Link
                key={period.id}
                href={buildHref({ hall: currentHall, date, period: period.name })}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-lg border px-3 py-1.5 ${
                  active
                    ? 'border-rule-strong bg-paper-sunk'
                    : 'border-rule bg-paper-raised'
                }`}
              >
                <span className="signage block text-sm leading-tight">{period.name}</span>
                <span
                  className={`data block text-[10px] leading-tight ${
                    servingNow ? 'font-semibold text-serving' : 'text-ink-faint'
                  }`}
                >
                  {servingNow ? 'serving now' : (period.timeLabel ?? '')}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
