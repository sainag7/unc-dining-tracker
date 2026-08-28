/**
 * Every "today" in this app is Chapel Hill's today.
 *
 * Server-local or UTC dates would push an 8pm ET dinner onto tomorrow's log,
 * so all date resolution goes through here.
 */
export const CAMPUS_TZ = 'America/New_York';

/** Current date at UNC as "YYYY-MM-DD". */
export function campusToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is what we want to store.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Current wall-clock time at UNC as "HH:MM" (24h). */
export function campusTimeOfDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: CAMPUS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/** Adds whole days to a "YYYY-MM-DD" string without tripping over timezones. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** `[startDate, startDate+1, ... ]` for `count` days. */
export function dateRange(startDate: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startDate, i));
}

interface Period {
  startTime: string | null;
  endTime: string | null;
}

/**
 * Index of the period being served right now, or -1 if the halls are between
 * services or closed.
 *
 * Kept strict and separate from tab selection: the "serving now" badge must
 * never appear at 5am just because Breakfast is the sensible tab to open on.
 */
export function servingMealPeriodIndex(
  periods: Period[],
  nowHHMM: string = campusTimeOfDay(),
): number {
  return periods.findIndex((p) => {
    if (!p.startTime || !p.endTime) return false;
    // A period ending at or before its start crosses midnight (e.g. 9pm-2am).
    return p.endTime <= p.startTime
      ? nowHHMM >= p.startTime || nowHHMM < p.endTime
      : nowHHMM >= p.startTime && nowHHMM < p.endTime;
  });
}

/**
 * Which meal period tab to open on.
 *
 * The one being served if there is one; otherwise the next to start today, and
 * failing that the first of the day — so the menu always opens on something
 * useful, even at 5am or after the last service ends.
 */
export function currentMealPeriodIndex(
  periods: Period[],
  nowHHMM: string = campusTimeOfDay(),
): number {
  if (periods.length === 0) return 0;

  const serving = servingMealPeriodIndex(periods, nowHHMM);
  if (serving !== -1) return serving;

  const upcoming = periods.findIndex((p) => p.startTime !== null && nowHHMM < p.startTime);
  return upcoming !== -1 ? upcoming : 0;
}

/**
 * Normalises a Postgres `time` to the "HH:MM" the rest of this module speaks.
 *
 * `menu_periods.start_time` is a `time` column, and Supabase returns those as
 * "15:00:00". Everything here compares against campusTimeOfDay(), which is
 * "15:00" — and comparing those two as strings is subtly wrong at the edges:
 * "15:00" >= "15:00:00" is false, because the shorter string sorts first, so a
 * period read straight from the database does not count as started until a
 * minute after it starts. The unit tests never caught it because their
 * fixtures were already in "HH:MM".
 */
export function toHHMM(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * "17:00" -> "5:00pm", for the meal-period status line.
 *
 * The scraper stores 24h "HH:MM" (parseClock) and keeps UNC's own display
 * string separately as timeLabel — but that string is whatever the site typed
 * ("7am-10:45am", "3pm-5pm"), so it can't be split into a single edge without
 * re-parsing it. This formats the parsed value instead, which is why the line
 * can say "until 5:00pm" rather than echoing a whole range.
 *
 * Returns null on anything unparseable, so the caller falls back to the
 * label UNC gave rather than printing a broken time.
 */
export function formatClock(raw: string | null): string | null {
  const hhmm = toHHMM(raw);
  if (!hhmm) return null;

  const hour24 = Number(hhmm.slice(0, 2));
  const minute = hhmm.slice(3, 5);
  if (hour24 > 23) return null;

  const meridiem = hour24 < 12 ? 'am' : 'pm';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute}${meridiem}`;
}
