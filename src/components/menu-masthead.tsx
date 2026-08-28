import Link from 'next/link';
import type { DiningHallRow } from '@/lib/supabase/database.types';
import type { MealPeriodSummary } from '@/lib/menu';
import { addDays, formatClock } from '@/lib/dates';
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
 * "Late Lunch" -> "Late lunch".
 *
 * Display only. The stored name stays Title Case because it is the ?period=
 * URL value and the key MEAL_PERIOD_ORDER sorts the log by — lowercasing at
 * the source would silently break both.
 */
const sentenceCase = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

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
  const hallName = shortHall(halls.find((h) => h.slug === currentHall)?.name ?? 'Menu');
  const otherHalls = halls.filter((h) => h.slug !== currentHall);

  const periodSegments: Segment[] = periods.map((p) => ({
    value: p.name,
    label: sentenceCase(p.name),
    href: href({ hall: currentHall, date, period: p.name }),
    dot: p.name === servingNowPeriod,
  }));

  // Says in words what the dot says as a mark: whether the period you're
  // looking at is the one being served, and until (or between) when. Without
  // it "Late lunch •" is a decoration you have to already know how to read.
  const servingNow = currentPeriod !== null && currentPeriod === servingNowPeriod;
  const until = formatClock(period?.endTime ?? null);
  const opens = formatClock(period?.startTime ?? null);
  const status = servingNow
    ? until
      ? `Serving now · until ${until}`
      : 'Serving now'
    : opens && until
      ? `Served ${opens}–${until}`
      : period?.timeLabel
        ? `Served ${period.timeLabel}`
        : null;

  return (
    <header className="border-b border-border">
      <div className="mx-auto w-full max-w-[640px] px-4 pt-2">
        {/*
          The venue is the heading, and the other venues sit beside it as
          links. This used to be a "Tray" wordmark over a separate hall
          switcher — two bands, 92px, and the word "Tray" naming both the app
          and the sheet at the bottom of the same screen. The product keeps
          its name in the tab bar and the title; the header says where you are.
        */}
        <div className="flex items-center gap-3">
          <h1 className="wordmark min-w-0 truncate">{hallName}</h1>

          <nav aria-label="Dining hall" className="flex min-w-0 items-center gap-3">
            {otherHalls.map((h) => (
              <Link
                key={h.slug}
                href={href({ hall: h.slug, date, period: currentPeriod })}
                className="truncate text-body font-medium text-text-muted underline underline-offset-4"
              >
                {shortHall(h.name)}
              </Link>
            ))}
          </nav>

          <span className="flex-1" />

          <div className="-mr-2 flex shrink-0 items-center">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href={href({ hall: currentHall, date: addDays(date, -1), period: currentPeriod })}
            aria-label="Previous day"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted"
          >
            <ChevronLeft />
          </Link>

          {/* Service hours ride along with the date rather than taking a row
              of their own — they're a property of the day you're looking at. */}
          <span className="data min-w-0 flex-1 truncate text-center text-body font-medium">
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
              className="-mr-2 flex h-11 shrink-0 items-center rounded-md px-2 text-meta font-medium underline underline-offset-2"
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

        {status && (
          <p className="data hairline-t py-1.5 text-micro text-text-muted">{status}</p>
        )}
      </div>

      {/*
        Adds write to the date on screen, not to today. That's what makes
        backfilling a day you forgot possible, and it's invisible unless it's
        said out loud — so it is.
      */}
      {!isToday && (
        <p className="mx-auto w-full max-w-[640px] px-4 pb-2 text-meta font-medium text-danger">
          Logging to {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}, not
          today
        </p>
      )}
    </header>
  );
}
