import { goalProgress } from '@/lib/log';

/**
 * A ring that fills clockwise from twelve o'clock as a value approaches a goal.
 *
 * Extracted from the tray bar's plate, which was the first one. There are five
 * rings on screen now — the plate, the day's calories, and one per macro — and
 * they were about to be five copies of the same dash-offset arithmetic.
 *
 * Geometry is normalised to a 100-unit box so `stroke` reads as a percentage of
 * the diameter rather than a number that only means something at one size: the
 * same stroke value gives the same visual weight on a 28px ring and a 150px one.
 *
 * The centre is `children`, not a fixed shape. That is the whole reason this
 * exists — the plate draws a dot there, the macro rings print `61 /278g`, and
 * the calories ring prints a number the size of a headline.
 */
export function ProgressRing({
  value,
  goal,
  size,
  stroke = 10,
  arcClassName,
  trackClassName = 'text-border',
  label,
  children,
}: {
  value: number;
  goal: number;
  /** Rendered pixel size. The ring is always square. */
  size: number;
  /** Arc width, in units of a 100-wide box — so 10 is a tenth of the diameter. */
  stroke?: number;
  /** Colour for the filled arc. A text-* class; the arc uses currentColor. */
  arcClassName: string;
  trackClassName?: string;
  /**
   * Announced to screen readers. Omit only where an ancestor already says it —
   * the tray bar is one button whose own label carries the number, and a
   * progressbar nested inside it would corrupt that name.
   */
  label?: string;
  children?: React.ReactNode;
}) {
  const { pct } = goalProgress(value, goal);

  const radius = (100 - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // The arc is one dash the length of the whole circle, pushed back out of
  // view by however much of the goal is left.
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      {...(label
        ? {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuenow': Math.round(value),
            'aria-valuemin': 0,
            'aria-valuemax': goal,
          }
        : { 'aria-hidden': true })}
    >
      <svg
        focusable="false"
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        className={arcClassName}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          className={trackClassName}
          stroke="currentColor"
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          // Start at twelve and fill clockwise. Without this the arc begins at
          // three o'clock, which reads as a clock face running late.
          transform="rotate(-90 50 50)"
          /*
            stroke-dashoffset is neither transform nor opacity, which globals.css
            otherwise holds the line on. It earns the exception — there is no
            transform that draws an arc — and the reason behind that rule still
            holds, because this is paint-only and triggers no layout. The global
            prefers-reduced-motion block zeroes it with !important.
          */
          style={{ transition: 'stroke-dashoffset var(--dur-base) var(--ease)' }}
        />
      </svg>

      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
