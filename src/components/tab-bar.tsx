'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The whole app is two places. This bar is the only navigation.
 *
 * It carries today's calorie count on the Log tab, which is why there's no
 * separate running-total bar competing for the bottom of the screen.
 */
export function TabBar({ todayCalories }: { todayCalories: number | null }) {
  const pathname = usePathname();

  // Auth and settings are pushed screens, not destinations — no bar there.
  if (pathname === '/login' || pathname === '/settings') return null;

  const onLog = pathname.startsWith('/log');

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t-2 border-rule-strong bg-paper-raised pb-[env(safe-area-inset-bottom)]"
    >
      <Tab href="/" label="Menus" active={!onLog} />
      <Tab
        href="/log"
        label="Log"
        active={onLog}
        detail={todayCalories === null ? null : `${todayCalories.toLocaleString()} cal`}
      />
    </nav>
  );
}

function Tab({
  href,
  label,
  active,
  detail,
}: {
  href: string;
  label: string;
  active: boolean;
  detail?: string | null;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="flex h-15 flex-col items-center justify-center gap-0.5"
      style={{ height: 'var(--tab-bar-h)' }}
    >
      {/* The active tab is marked by a bar above it, the way a board marks a
          selected panel — no icon set to invent, nothing to mistake for decoration. */}
      <span
        aria-hidden
        className={`h-0.5 w-8 ${active ? 'bg-carolina' : 'bg-transparent'}`}
      />
      <span
        className={`signage text-sm ${active ? 'text-ink' : 'text-ink-faint'}`}
      >
        {label}
      </span>
      {detail && (
        <span className={`data text-[10px] ${active ? 'text-ink-soft' : 'text-ink-faint'}`}>
          {detail}
        </span>
      )}
    </Link>
  );
}
