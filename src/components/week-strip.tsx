import Link from 'next/link';
import { addDays } from '@/lib/dates';

function parts(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' }),
    day: dt.getUTCDate(),
  };
}

/**
 * The last seven days, tap to switch.
 *
 * Replaces a prev/next stepper: seeing which days you logged is the point, and
 * an arrow can't show that.
 */
export function WeekStrip({
  selected,
  today,
  loggedDates,
}: {
  selected: string;
  today: string;
  loggedDates: Set<string>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <nav aria-label="Pick a day" className="flex gap-1">
      {days.map((date) => {
        const { weekday, day } = parts(date);
        const isSelected = date === selected;
        const hasEntries = loggedDates.has(date);

        return (
          <Link
            key={date}
            href={`/log?date=${date}`}
            aria-current={isSelected ? 'page' : undefined}
            className={`flex-1 rounded-sm border-t-2 pt-2 pb-1.5 text-center transition-colors duration-150 ease-out ${
              isSelected ? 'border-text' : 'border-border'
            }`}
          >
            <span
              className={`placard block ${isSelected ? 'text-text' : 'text-text-muted'}`}
              aria-hidden
            >
              {weekday}
            </span>
            <span
              className={`data block text-body ${isSelected ? 'font-semibold text-text' : 'text-text-muted'}`}
            >
              {day}
            </span>
            {/* A dot means something was logged that day. */}
            <span
              aria-hidden
              className={`mx-auto mt-1 block h-1 w-1 rounded-full ${
                hasEntries ? 'bg-text' : 'bg-transparent'
              }`}
            />
            <span className="sr-only">
              {date === today ? 'Today' : date}
              {hasEntries ? ', has entries' : ', nothing logged'}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
