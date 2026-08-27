'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';

export type Segment = {
  value: string;
  label: string;
  href: string;
  /** Rendered after the label as a quiet pill — used for "now". */
  badge?: string;
};

/**
 * The venue switcher and the meal-period tabs.
 *
 * The indicator is one absolutely-positioned element that translates between
 * segments rather than a border re-drawn on each item, so the movement is a
 * single transform and reads as the same object moving.
 *
 * Segments are links, not buttons: every one of them is a real URL, so they
 * must stay shareable and middle-clickable.
 */
export function SegmentedControl({
  segments,
  value,
  label,
  scrollActiveIntoView = false,
}: {
  segments: Segment[];
  value: string;
  label: string;
  /** For the period strip, which can overflow on a phone. */
  scrollActiveIntoView?: boolean;
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
      className="no-scrollbar relative flex gap-1 overflow-x-auto"
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
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
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 text-body font-medium whitespace-nowrap transition-colors duration-150 ease-out ${
              active ? 'text-text' : 'text-text-muted'
            }`}
          >
            {s.label}
            {s.badge && (
              <span className="placard rounded-sm bg-accent px-1.5 py-0.5 text-accent-fg">
                {s.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
