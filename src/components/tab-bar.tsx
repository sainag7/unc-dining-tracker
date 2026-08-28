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
    // Full-bleed outer so the rule and the surface span the window; the tabs
    // themselves sit in the same 640px column as everything above them.
    // Before this they landed at 25% and 75% of the viewport, nowhere near
    // the content they navigate.
    <nav
      aria-label="Main"
      className="hairline-t fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid w-full max-w-[640px] grid-cols-2">
        <Tab href="/" label="Menus" icon={<Tray size={18} />} active={!onLog} />
        <Tab href="/log" label="Log" icon={<ListIcon size={18} />} active={onLog} />
      </div>
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
      className={`flex flex-col items-center gap-1 pt-[9px] pb-[13px] transition-colors duration-150 ease-out ${
        active ? 'text-accent-text' : 'text-text-muted'
      }`}
    >
      {icon}
      <span className={`text-micro ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </Link>
  );
}
