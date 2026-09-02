'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';

export type Segment = {
  value: string;
  label: string;
  href: string;
  /** A small accent dot after the label. Means "being served right now". */
  dot?: boolean;
};

/**
 * The venue switcher and the meal-period tabs.
 *
 * Selection is a filled pill sliding in a groove. It used to be a 2px rule
 * under the active word — which is a fine desktop idiom and a poor phone one:
 * a hairline under a label is the smallest possible way to say the most
 * important thing on the control, and on the hall switcher it wasn't even
 * that, just underlined text links that read as links rather than as a choice
 * you were already inside of.
 *
 * The indicator is still one absolutely-positioned element that translates
 * between segments rather than a background re-drawn on each item, so the
 * movement is a single transform and reads as the same object moving.
 *
 * Segments are links, not buttons: every one of them is a real URL, so they
 * must stay shareable and middle-clickable.
 */
export function SegmentedControl({
  segments,
  value,
  label,
  scrollActiveIntoView = false,
  fill = false,
}: {
  segments: Segment[];
  value: string;
  label: string;
  /** For the period strip, which can overflow on a phone. */
  scrollActiveIntoView?: boolean;
  /**
   * Split the available width evenly instead of sizing to the labels. For the
   * hall switcher, which has two segments and a whole row to itself; the
   * period strip stays label-width so it can scroll.
   */
  fill?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const active = list.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;

    const place = () => setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    place();

    if (scrollActiveIntoView) {
      active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }

    // Font swap and container resize both move the target.
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value, segments, scrollActiveIntoView]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      // p-1 is the groove: the pill insets by that much on every side, which
      // is what makes it read as sitting *in* the track rather than as the
      // track itself. inset-y-1 on the indicator below is the same 4px.
      className={`no-scrollbar relative flex rounded-full bg-surface-alt p-1 ${
        fill ? '' : 'overflow-x-auto'
      }`}
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute inset-y-1 rounded-full bg-accent shadow-[var(--shadow-card)] transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
        />
      )}

      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Link
            key={s.value}
            href={s.href}
            role="tab"
            aria-selected={active}
            data-active={active}
            // relative + z-10 so the label paints above the sliding indicator;
            // without it the pill covers the word it is selecting.
            className={`relative z-10 flex h-10 items-center justify-center gap-[5px] rounded-full px-4 text-body whitespace-nowrap transition-colors duration-150 ease-out ${
              fill ? 'min-w-0 flex-1' : 'shrink-0'
            } ${active ? 'font-semibold text-accent-fg' : 'font-medium text-text-muted'}`}
          >
            <span className="truncate">{s.label}</span>
            {/*
              A 5px dot, not a filled NOW pill. Selection is the pill; the dot
              is only ever "serving now". On the selected segment it takes the
              label's own colour — navy on Carolina — because an accent dot on
              an accent pill is invisible. Off it, it stays Carolina, which is
              where it has work to do: it's how you spot the meal being served
              while looking at a different one.
            */}
            {s.dot && (
              <span
                aria-hidden
                className={`h-[5px] w-[5px] shrink-0 rounded-full ${
                  active ? 'bg-current' : 'bg-accent'
                }`}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
