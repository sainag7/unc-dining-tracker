import Link from 'next/link';
import type { DiningHallRow } from '@/lib/supabase/database.types';
import type { MealPeriodSummary } from '@/lib/menu';
import { addDays } from '@/lib/dates';
import { SegmentedControl, type Segment } from '@/components/ui/segmented-control';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';

/**
 * Builds a menu URL.
 *
 * `period` is carried through deliberately: it used to be dropped from the
 * day and hall links, so stepping from Tuesday to Wednesday while looking at
 * dinner silently put you back on breakfast.
 */
function href(params: { hall: string; date: string; period?: string | null }) {
  const search = new URLSearchParams({ hall: params.hall, date: params.date });
  if (params.period) search.set('period', params.period);
  return `/?${search.toString()}`;
}

/** "Thu, Aug 21", resolved in UTC so the stored date never shifts. */
function formatDate(isoDate: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    ...opts,
    timeZone: 'UTC',
  });
}

/** Strips "Dining Hall" — the switcher has no room for words that say nothing. */
const shortHall = (name: string) => name.replace(/\s*dining hall\s*/i, '').trim();

/**
 * Hall, date, and meal period.
 *
 * Deliberately not sticky. At five rows tall it's over a third of a phone
 * screen, and the thing actually worth keeping on screen while you scroll a
 * long menu is the station placard — which pins at the top instead.
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
  const period = periods.find((p) => p.name === currentPeriod);
  const isToday = date === today;

  const hallSegments: Segment[] = halls.map((h) => ({
    value: h.slug,
    label: shortHall(h.name),
    href: href({ hall: h.slug, date, period: currentPeriod }),
  }));

  const periodSegments: Segment[] = periods.map((p) => ({
    value: p.name,
    label: p.name,
    href: href({ hall: currentHall, date, period: p.name }),
    badge: p.name === servingNowPeriod ? 'now' : undefined,
  }));

  return (
    <header className="border-b border-border">
      <div className="mx-auto w-full max-w-[640px] px-4 pt-2">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="wordmark">
            Tray
          </Link>
          <div className="-mr-2 flex items-center">
            <ThemeToggle />
          </div>
        </div>

        {hallSegments.length > 1 && (
          <div className="mt-1">
            <SegmentedControl segments={hallSegments} value={currentHall} label="Dining hall" />
          </div>
        )}

        <div className="mt-1 flex items-center gap-1">
          <Link
            href={href({ hall: currentHall, date: addDays(date, -1), period: currentPeriod })}
            aria-label="Previous day"
            className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted"
          >
            <ChevronLeft />
          </Link>

          <span className="data flex-1 text-center text-body font-medium">
            {isToday ? 'Today' : formatDate(date, { weekday: 'short' })}
            <span className="text-text-muted">
              {' · '}
              {formatDate(date, { month: 'short', day: 'numeric' })}
            </span>
          </span>

          <Link
            href={href({ hall: currentHall, date: addDays(date, 1), period: currentPeriod })}
            aria-label="Next day"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted"
          >
            <ChevronRight />
          </Link>

          {/* Only worth screen space once you've navigated away from it. */}
          {!isToday && (
            <Link
              href={href({ hall: currentHall, date: today, period: currentPeriod })}
              className="-mr-2 flex h-11 shrink-0 items-center rounded-md px-2 text-meta font-medium text-accent-text"
            >
              Today
            </Link>
          )}
        </div>

        {periodSegments.length > 0 && (
          <SegmentedControl
            segments={periodSegments}
            value={currentPeriod ?? ''}
            label="Meal period"
            scrollActiveIntoView
          />
        )}
      </div>

      {period?.timeLabel && (
        <p className="mx-auto w-full max-w-[640px] px-4 pt-1.5 pb-2 text-meta text-text-muted">
          <span className="data">Served {period.timeLabel}</span>
        </p>
      )}
    </header>
  );
}
