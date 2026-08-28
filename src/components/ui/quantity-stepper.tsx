'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from './icons';
import { formatServings } from '@/lib/servings';

/**
 * How much of a thing is on the tray, and the only control that changes it.
 *
 * Two states in one 27px-tall footprint. At zero it's a quiet outlined circle,
 * so a menu of forty items doesn't render forty filled accent circles down the
 * right edge — that stripe pulled the eye vertically down the page instead of
 * across each row, which is the direction you actually read a menu in.
 *
 * Once something is logged it becomes a pill you can count down as well as up.
 * The old control could only add: eighteen helpings meant eighteen taps and no
 * way back short of opening the log.
 *
 * The rendered control is 27px but every button carries a 44px hit area, via
 * an inset pseudo-element rather than padding — padding would widen the
 * control and push the calorie column around as rows change state.
 */
export function QuantityStepper({
  servings,
  label,
  onAdd,
  onRemove,
  disabled = false,
}: {
  servings: number;
  /** The item's name, for the buttons' accessible labels. */
  label: string;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  // The count springs when it changes, so a tap registers even when your thumb
  // is covering the number.
  const [bumped, setBumped] = useState(false);
  const previous = useRef(servings);
  useEffect(() => {
    const changed = servings !== previous.current;
    previous.current = servings;
    if (!changed) return;

    setBumped(true);
    const timer = setTimeout(() => setBumped(false), 150);
    return () => clearTimeout(timer);
  }, [servings]);

  const tap = (run: () => void) => () => {
    // Short, single pulse. Confirms the tap without announcing itself.
    navigator.vibrate?.(10);
    run();
  };

  if (servings <= 0) {
    return (
      <button
        type="button"
        onClick={tap(onAdd)}
        disabled={disabled}
        aria-label={`Add ${label}`}
        className={`${HIT} flex h-[27px] w-[27px] items-center justify-center rounded-full border-[0.5px] border-border-strong text-text-mid disabled:opacity-40`}
      >
        <Plus size={15} />
      </button>
    );
  }

  return (
    <span className="flex h-[27px] items-center gap-1.5 rounded-[14px] bg-accent px-2 py-[3px] text-accent-fg">
      <button
        type="button"
        onClick={tap(onRemove)}
        disabled={disabled}
        aria-label={`Remove one ${label}. ${formatServings(servings)} on the tray.`}
        className={`${HIT} on-accent flex items-center justify-center disabled:opacity-40`}
      >
        <Minus size={14} />
      </button>

      <span
        className={`data min-w-[1ch] text-center text-micro font-semibold tabular-nums ${
          bumped ? 'motion-safe:scale-125' : ''
        } transition-transform duration-150 ease-out motion-reduce:transition-none`}
      >
        {formatCount(servings)}
      </span>

      <button
        type="button"
        onClick={tap(onAdd)}
        disabled={disabled}
        aria-label={`Add another ${label}. ${formatServings(servings)} on the tray.`}
        className={`${HIT} on-accent flex items-center justify-center disabled:opacity-40`}
      >
        <Plus size={14} />
      </button>
    </span>
  );
}

/**
 * A 44px touch target around a control that renders smaller.
 *
 * `before:` rather than padding: padding would grow the control's box and shift
 * everything laid out beside it. The overlay is transparent and sits above the
 * row's own tap target, so it catches the near-misses without moving a pixel.
 */
const HIT =
  'relative before:absolute before:top-1/2 before:left-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]';

/** 3 → "3", 1.5 → "1.5". The × belongs in the label, not the pill. */
function formatCount(servings: number): string {
  return String(Math.round(servings * 100) / 100);
}
