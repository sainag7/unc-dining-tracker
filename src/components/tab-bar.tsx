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
    // A floating pill, matching the tray pill directly above it. It used to be
    // a full-bleed bar capped with a hairline; the two of them stacked read as
    // one 110px slab of chrome across the bottom of the screen. Floating them
    // both lets the list show through between and around, which is what makes
    // the bottom of the screen feel like less of a wall.
    //
    // 608px matches the content column's inner width, so the pill lines up
    // with the cards rather than with the window.
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="card mx-auto grid w-full max-w-[608px] grid-cols-2 rounded-full p-1.5 shadow-[var(--shadow-float)]">
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
      // The active tab is a filled pill, not a change of ink. Colour and
      // weight alone were doing the whole job before, on a 60px bar with no
      // other marks on it — legible, but nothing you could hit with a thumb
      // without reading first.
      className={`flex flex-col items-center gap-[3px] rounded-full py-1.5 transition-colors duration-150 ease-out ${
        active ? 'bg-accent text-accent-fg' : 'text-text-muted'
      }`}
    >
      {icon}
      <span className={`text-micro ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </Link>
  );
}
