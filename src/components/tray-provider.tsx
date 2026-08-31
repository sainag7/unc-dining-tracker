'use client';

import { createContext, useContext, useOptimistic } from 'react';

/**
 * The tray's running totals, moved off the server's critical path.
 *
 * The number in the tray bar used to be a prop from the root layout, and the
 * root layout is the one segment Next does not re-render for a server action's
 * response. So the only way to move it was `router.refresh()` — a second full
 * render of the whole tree, refetching all 272 recipes on the menu behind it,
 * to change one integer. Against a remote Supabase at ~200-460ms per round
 * trip that is most of the three seconds between tapping + and seeing the
 * total change.
 *
 * Nothing about that work was needed. The client already knows the calories of
 * the thing it just added — `item.calories` is right there in the row it was
 * tapped on.
 *
 * useOptimistic rather than plain state, because the server value is still the
 * truth: the optimistic delta applies on top of whatever the layout last sent,
 * and React drops it automatically the moment a newer server value arrives. A
 * failed write needs no rollback code — the delta simply stops being applied.
 */
interface TrayTotals {
  calories: number;
  protein: number;
  /** Distinct lines on the tray, not total servings. */
  count: number;
}

/**
 * A change to apply before the server has confirmed it.
 *
 * `lines` is separate from the macros because they move independently: a second
 * helping of something already on the tray adds calories but no new line, and
 * taking the last serving off removes the line as well as the calories. +1, 0
 * or -1.
 */
export interface TrayDelta {
  calories: number;
  protein: number;
  lines: number;
}

interface TrayContextValue extends TrayTotals {
  /** Moves the totals now, before the write is sent. */
  adjust: (change: TrayDelta) => void;
}

const TrayContext = createContext<TrayContextValue | null>(null);

export function TrayProvider({
  calories,
  protein,
  count,
  children,
}: TrayTotals & { children: React.ReactNode }) {
  const [totals, applyDelta] = useOptimistic(
    { calories, protein, count },
    (current: TrayTotals, change: TrayDelta) => ({
      // Clamped at zero: two fast decrements can both read the same base
      // before either write lands, and a tray reading "-90 cal" is worse than
      // one that briefly reads 0 and settles a moment later.
      calories: Math.max(0, current.calories + change.calories),
      protein: Math.max(0, current.protein + change.protein),
      count: Math.max(0, current.count + change.lines),
    }),
  );

  return (
    <TrayContext.Provider value={{ ...totals, adjust: applyDelta }}>
      {children}
    </TrayContext.Provider>
  );
}

/**
 * The tray totals, or null when there is no tray — signed out, or on a route
 * where the bar doesn't render. Callers outside a provider get null rather
 * than a throw, so a menu row works signed out without a special case.
 */
export function useTray(): TrayContextValue | null {
  return useContext(TrayContext);
}
