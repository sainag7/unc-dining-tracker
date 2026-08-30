import { goalProgress } from '@/lib/log';

/**
 * The plate: today's calories against the goal, as a ring that closes.
 *
 * The tray bar used to report a bare number — `840`, with no answer to "of
 * what". The goal lived on the log screen, one navigation away, which is the
 * wrong place for it when you're standing in the serving line deciding whether
 * to take the second plate.
 *
 * It's a plate seen from above: a rim that fills clockwise from twelve o'clock,
 * and food in the middle. Past the goal the ring stays closed and turns
 * `--danger` — the arc can't say "160%", so the colour does, and the exact
 * number is right beside it.
 *
 * Not in `icons.tsx`: that file's `Svg` wrapper sets `stroke="currentColor"` on
 * the whole element, and this needs a track and an arc in two different colours.
 * The conventions from that file are matched by hand.
 */
export function PlateRing({
  calories,
  goal,
  size = 28,
}: {
  calories: number;
  goal: number;
  size?: number;
}) {
  const { pct, over } = goalProgress(calories, goal);

  // Geometry in a 24-unit box, matching every other icon's viewBox so the ring
  // sits on the same optical grid as the chevron beside it.
  const stroke = 2.5;
  const radius = (24 - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // The arc is drawn as one dash the length of the whole circle, then pushed
  // back out of view by however much of the goal is left.
  const offset = circumference * (1 - pct / 100);

  const color = over ? 'text-danger' : 'text-accent-text';

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${color}`}
    >
      {/*
        The rim. Deliberately faint — it's the groove, not the reading. What
        conveys progress is the arc against the bar behind it (4.05:1 light,
        6.09:1 dark); if the track vanished entirely the ring would still say
        the same thing. Same call the macro hairlines on the log screen make.
      */}
      <circle
        cx="12"
        cy="12"
        r={radius}
        className="text-border-strong"
        stroke="currentColor"
        strokeWidth={stroke}
      />

      <circle
        cx="12"
        cy="12"
        r={radius}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        // Start at twelve o'clock and fill clockwise. Without this the arc
        // begins at three o'clock, which reads as a clock face running late.
        transform="rotate(-90 12 12)"
        /*
          stroke-dashoffset is the one thing here that isn't transform or
          opacity, which globals.css otherwise holds the line on. It earns the
          exception: there is no transform that draws an arc, and the reason
          for that rule — never triggering layout — still holds, because this
          is paint-only. The global prefers-reduced-motion block already zeroes
          it with !important, so there's no motion-safe: prefix to add.
        */
        style={{
          transition: 'stroke-dashoffset var(--dur-base) var(--ease)',
        }}
      />

      {/* What's on the plate. */}
      <circle cx="12" cy="12" r="3.25" fill="currentColor" />
    </svg>
  );
}
