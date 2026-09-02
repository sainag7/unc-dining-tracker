'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Close } from './icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Past this much of the way down, a release closes instead of snapping back. */
const CLOSE_FRACTION = 0.55;
/** Fast enough that direction beats position — a flick, not a drag. */
const FLICK_VELOCITY = 0.5;

export type Snap = 'peek' | 'expanded';

/**
 * The bottom sheet every dialog in the app shares.
 *
 * Replaces two hand-rolled copies that each did scroll-lock and Escape but
 * neither of which trapped focus — tab far enough and you were behind the
 * scrim, operating a page you couldn't see.
 *
 * With `snapping`, it also takes two positions: peek, where only the header
 * shows, and expanded. That's what the tray needs — the total is worth a
 * glance without giving up the menu behind it, and the list is worth a drag.
 * Everything else opens expanded and has no handle.
 */
export function Sheet({
  label,
  onClose,
  children,
  footer,
  snapping = false,
  initialSnap = 'expanded',
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Two positions plus a drag handle, rather than one fixed height. */
  snapping?: boolean;
  initialSnap?: Snap;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // onClose lives in a ref so the effect below doesn't depend on it. Both call
  // sites pass an inline arrow, so it's a new function on every render — the
  // effect used to tear down and re-run on each one, re-running the initial
  // focus() and yanking focus back to the close button mid-interaction. A
  // router.refresh() after logging food was enough to trigger it.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    // Restore rather than clear — the sheet may not be the only thing that
    // has an opinion about body overflow.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = Array.from(panel!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={`Close ${label.toLowerCase()}`}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 motion-safe:animate-[fade_150ms_var(--ease)]"
      />

      <SheetPanel
        panelRef={panelRef}
        headerRef={headerRef}
        label={label}
        onClose={onClose}
        footer={footer}
        snapping={snapping}
        initialSnap={initialSnap}
      >
        {children}
      </SheetPanel>
    </div>
  );
}

function SheetPanel({
  panelRef,
  headerRef,
  label,
  onClose,
  children,
  footer,
  snapping,
  initialSnap,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  snapping: boolean;
  initialSnap: Snap;
}) {
  const [snap, setSnap] = useState<Snap>(initialSnap);
  /** How far down peek sits: everything below the header. */
  const [peekOffset, setPeekOffset] = useState(0);
  /** Live finger position during a drag; null when not dragging. */
  const [dragY, setDragY] = useState<number | null>(null);
  /** Off for the first frame so the sheet animates in from the bottom. */
  const [entered, setEntered] = useState(!snapping);

  const drag = useRef<{ startY: number; startOffset: number; time: number } | null>(null);

  useLayoutEffect(() => {
    if (!snapping) return;
    const panel = panelRef.current;
    const header = headerRef.current;
    if (!panel || !header) return;

    const measure = () => setPeekOffset(panel.offsetHeight - header.offsetHeight);
    measure();

    // The list inside changes height as the tray does.
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [snapping, panelRef, headerRef]);

  useEffect(() => {
    if (!snapping) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [snapping]);

  const restingOffset = snap === 'peek' ? peekOffset : 0;
  const offset = dragY ?? restingOffset;
  // A percentage of the panel's own height, so the entry travel is right
  // without reading the viewport during render — which would break SSR.
  const transform = entered ? `translateY(${Math.max(0, offset)}px)` : 'translateY(100%)';

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!snapping) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      drag.current = { startY: e.clientY, startOffset: restingOffset, time: performance.now() };
      setDragY(restingOffset);
    },
    [snapping, restingOffset],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const delta = e.clientY - drag.current.startY;
    // Rubber-band above expanded: you can pull up, but not far.
    const next = drag.current.startOffset + delta;
    setDragY(next < 0 ? next / 4 : next);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = drag.current;
      if (!start) return;
      drag.current = null;

      const travelled = e.clientY - start.startY;
      const elapsed = Math.max(1, performance.now() - start.time);
      const velocity = travelled / elapsed;
      const landed = start.startOffset + travelled;

      setDragY(null);

      // A downward flick beats position; otherwise the nearer stop wins.
      if (velocity > FLICK_VELOCITY) {
        if (start.startOffset >= peekOffset) onClose();
        else setSnap('peek');
        return;
      }
      if (velocity < -FLICK_VELOCITY) {
        setSnap('expanded');
        return;
      }
      if (peekOffset > 0 && landed > peekOffset * (1 + CLOSE_FRACTION)) {
        onClose();
        return;
      }
      setSnap(landed > peekOffset / 2 ? 'peek' : 'expanded');
    },
    [onClose, peekOffset],
  );

  const dragging = dragY !== null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={snapping ? { transform } : undefined}
      className={`relative flex max-h-[92vh] w-full max-w-[640px] flex-col rounded-t-[var(--radius-xl)] bg-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-sheet)] sm:rounded-[var(--radius-xl)] ${
        snapping
          ? `will-change-transform ${dragging ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`
          : 'motion-safe:animate-[sheet-in_200ms_var(--ease)]'
      }`}
    >
      <div
        ref={headerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={snapping ? 'shrink-0 touch-none' : 'shrink-0'}
      >
        {/*
          The handle is decoration for a mouse and the whole affordance on a
          phone, so it's aria-hidden and the drag region is the header. The
          keyboard path is Escape and the close button, which already work.
        */}
        {snapping && (
          <div className="flex justify-center pt-2 pb-1">
            <span aria-hidden className="h-1 w-9 rounded-full bg-border-strong" />
          </div>
        )}

        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <h2 className="text-input font-semibold">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-alt text-text-muted"
          >
            <Close />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

      {footer && (
        <div className="border-t border-border px-4 pt-3 pb-3">{footer}</div>
      )}
    </div>
  );
}
