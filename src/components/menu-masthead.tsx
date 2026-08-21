import Link from 'next/link';
import type { DiningHallRow } from '@/lib/supabase/database.types';
import type { MealPeriodSummary } from '@/lib/menu';
import { addDays } from '@/lib/dates';

function href(params: { hall: string; date: string; period?: string }) {
  const search = new URLSearchParams({ hall: params.hall, date: params.date });
  if (params.period) search.set('period', params.period);
  return `/?${search.toString()}`;
}

/** "Thu Aug 21", resolved in UTC so the stored date never shifts. */
function formatDate(isoDate: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    ...opts,
    timeZone: 'UTC',
  });
}

/** Strips "Dining Hall" — the masthead has no room for words that say nothing. */
const shortHall = (name: string) => name.replace(/\s*dining hall\s*/i, '').trim();

/**
 * Hall, date, and meal period in one block.
 *
 * The old header stacked three full-width rows of controls before any food
 * appeared, which on a phone was most of the screen. This is a masthead:
 * the hall reads large, everything else is subordinate to it.
 */
export function MenuMasthead({
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
  const hall = halls.find((h) => h.slug === currentHall);
  const other = halls.find((h) => h.slug !== currentHall);
  const period = periods.find((p) => p.name === currentPeriod);

  return (
    <header className="px-4 pt-3">
      <div className="flex items-end justify-between gap-3 border-b-2 border-rule-strong pb-1.5">
        <div className="min-w-0">
          <h1 className="signage truncate text-[2rem] leading-none">
            {shortHall(hall?.name ?? 'Menu')}
          </h1>
          {other && (
            <Link
              href={href({ hall: other.slug, date })}
              className="mt-1 inline-block text-xs text-carolina underline underline-offset-2"
            >
              Switch to {shortHall(other.name)}
            </Link>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="data text-sm leading-tight">
            {date === today ? 'Today' : formatDate(date, { weekday: 'short' })}
          </div>
          <div className="data text-xs leading-tight text-ink-soft">
            {formatDate(date, { month: 'short', day: 'numeric' })}
          </div>
          <div className="mt-1 flex justify-end gap-2 text-xs">
            <Link
              href={href({ hall: currentHall, date: addDays(date, -1) })}
              className="text-carolina"
              aria-label="Previous day"
            >
              Prev
            </Link>
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <Link
              href={href({ hall: currentHall, date: addDays(date, 1) })}
              className="text-carolina"
              aria-label="Next day"
            >
              Next
            </Link>
          </div>
        </div>
      </div>

      {periods.length > 0 && (
        <>
          <div className="no-scrollbar -mx-4 mt-2 flex gap-4 overflow-x-auto px-4">
            {periods.map((p) => {
              const active = p.name === currentPeriod;
              return (
                <Link
                  key={p.id}
                  href={href({ hall: currentHall, date, period: p.name })}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 border-b-2 pb-1.5 ${
                    active ? 'border-carolina text-ink' : 'border-transparent text-ink-faint'
                  }`}
                >
                  <span className="signage text-[0.9375rem]">{p.name}</span>
                  {p.name === servingNowPeriod && (
                    <span className="label ml-1.5 text-serving">now</span>
                  )}
                </Link>
              );
            })}
          </div>

          {period?.timeLabel && (
            <p className="data mt-1.5 text-xs text-ink-soft">
              Served {period.timeLabel}
            </p>
          )}
        </>
      )}
    </header>
  );
}
