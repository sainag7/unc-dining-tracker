import { goalProgress } from '@/lib/log';
import { ProgressRing } from './progress-ring';

/**
 * The plate: today's calories against the goal, as a ring that closes.
 *
 * The tray bar used to report a bare number — `840`, with no answer to "of
 * what". The goal lived on the log screen, one navigation away, which is the
 * wrong place for it when you're standing in the serving line deciding whether
 * to take the second plate.
 *
 * It's a plate seen from above: a rim that fills clockwise from twelve o'clock,
 * and food in the middle. Past the goal the ring stays closed and turns red —
 * the arc can't say "160%", so the colour does, and the exact number is right
 * beside it.
 *
 * Its colours are the deep fill's, not the page's, because this only ever
 * appears on the tray pill. --accent-text and --border-strong were chosen back
 * when the tray bar was a light strip; on navy the first is muddy and the
 * second is a grey line on a dark ground. Both are now derived from --deep-fg,
 * which inverts with the pill.
 *
 * The drawing is ProgressRing's now; what's left here is the plate's own
 * decisions — its size, its colour rule, and the dot.
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
  const { over } = goalProgress(calories, goal);
  const color = over ? 'text-on-deep-danger' : 'text-deep-fg';

  return (
    <ProgressRing
      value={calories}
      goal={goal}
      size={size}
      // 2.5 in the old 24-unit box, kept identical here so the tray bar's ring
      // is unchanged by the extraction.
      stroke={10.4}
      arcClassName={color}
      trackClassName="text-deep-fg/25"
      // No label on purpose: the tray bar is one <button> whose aria-label
      // already carries the number, and a progressbar nested inside it would
      // corrupt that name computation.
    >
      {/* What's on the plate. */}
      <span
        aria-hidden
        className={`rounded-full bg-current ${color}`}
        style={{ width: size * 0.27, height: size * 0.27 }}
      />
    </ProgressRing>
  );
}
