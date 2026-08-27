'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tray, ListIcon } from './ui/icons';

/**
 * The whole app is two places. This bar is the only navigation.
 *
 * It no longer carries the day's calorie count — the tray bar sitting
 * directly above it does, at a size you can read while walking.
 */
export function TabBar() {
  const pathname = usePathname();

  // Auth and settings are pushed screens, not destinations — no bar there.
  if (pathname === '/login' || pathname === '/settings') return null;

  const onLog = pathname.startsWith('/log');

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <Tab href="/" label="Menus" icon={<Tray />} active={!onLog} />
      <Tab href="/log" label="Log" icon={<ListIcon />} active={onLog} />
    </nav>
  );
}

function Tab({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 ease-out ${
        active ? 'text-accent-text' : 'text-text-muted'
      }`}
      style={{ height: 'var(--tab-bar-h)' }}
    >
      {icon}
      <span className="text-meta font-medium">{label}</span>
    </Link>
  );
}
