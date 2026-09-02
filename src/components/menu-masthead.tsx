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
 * Two segmented controls stacked over a date stepper. The hall switcher used
 * to be an <h1> with the other venues beside it as underlined links, which
 * made the venue you were on and the venues you could reach two different
 * kinds of object — you had to read the heading to know what the links were
 * alternatives to. As a filled pill switcher they're one control with one
 * selected item, which is what they always were.
 *
 * Deliberately not sticky. It's over a third of a phone screen, and the thing
 * actually worth keeping on screen while you scroll a long menu is the
 * station placard — which pins at the top of its own card instead.
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

  // Every hall, including the one you're on — a switcher that hides the
  // current option is a menu, not a switch.
  const hallSegments: Segment[] = halls.map((h) => ({
    value: h.slug,
    label: shortHall(h.name),
    // href carries `period` through, which is what keeps dinner selected when
    // you cross from Chase to Lenoir.
    href: href({ hall: h.slug, date, period: currentPeriod }),
  }));

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
    <header>
      <div className="mx-auto w-full max-w-[640px] px-4 pt-3">
        {/*
          The venue name is no longer painted anywhere — the selected pill
          says it. This keeps the document's one <h1> for anything reading the
          page structurally rather than looking at it.
        */}
        <h1 className="sr-only">{hallName} menu</h1>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SegmentedControl
              segments={hallSegments}
              value={currentHall}
              label="Dining hall"
              fill
            />
          </div>

          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Link
            href={href({ hall: currentHall, date: addDays(date, -1), period: currentPeriod })}
            aria-label="Previous day"
            className="card flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-mid"
          >
            <ChevronLeft />
          </Link>

          {/* Service hours ride along with the date rather than taking a row
              of their own — they're a property of the day you're looking at. */}
          <span className="data min-w-0 flex-1 truncate text-center text-body font-semibold">
            {isToday ? 'Today' : formatDate(date, { weekday: 'short' })}
            <span className="font-medium text-text-muted">
              {' · '}
              {formatDate(date, { month: 'short', day: 'numeric' })}
            </span>
          </span>

          <Link
            href={href({ hall: currentHall, date: addDays(date, 1), period: currentPeriod })}
            aria-label="Next day"
            className="card flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-mid"
          >
            <ChevronRight />
          </Link>

          {/* Only worth screen space once you've navigated away from it. */}
          {!isToday && (
            <Link
              href={href({ hall: currentHall, date: today, period: currentPeriod })}
              className="card flex h-11 shrink-0 items-center rounded-full px-4 text-meta font-semibold text-accent-text"
            >
              Today
            </Link>
          )}
        </div>

        {periodSegments.length > 0 && (
          <div className="mt-2">
            <SegmentedControl
              segments={periodSegments}
              value={currentPeriod ?? ''}
              label="Meal period"
              scrollActiveIntoView
            />
          </div>
        )}

        {status && (
          <p className="data px-1 pt-2 text-micro font-medium text-text-muted">{status}</p>
        )}

        {/*
          Adds write to the date on screen, not to today. That's what makes
          backfilling a day you forgot possible, and it's invisible unless it's
          said out loud — so it is.
        */}
        {!isToday && (
          <p className="mt-2 inline-flex rounded-full bg-danger-bg px-3 py-1 text-meta font-semibold text-danger">
            Logging to{' '}
            {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}, not today
          </p>
        )}
      </div>
    </header>
  );
}
