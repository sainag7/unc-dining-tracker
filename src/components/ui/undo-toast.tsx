'use client';

import { useEffect } from 'react';

/** Long enough to notice and reach, short enough not to sit there. */
const LIFETIME_MS = 6000;

/**
 * A one-line "that happened, take it back" bar.
 *
 * It floats above the fixed bars rather than sitting in the list. The undo it
 * replaced was a band inside the menu, so every add pushed the whole list down
 * 53px and the row you were aiming at moved out from under your thumb.
 *
 * role="status", not "alert": undoing is optional, and an assertive live
 * region interrupts whatever the screen reader was saying about the add that
 * just succeeded.
 */
export function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, LIFETIME_MS);
    return () => clearTimeout(timer);
    // Re-arms whenever the message changes, so a second action gets its own
    // full window rather than inheriting the remains of the first one's.
  }, [message, onDismiss]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[45] px-4"
      style={{
        bottom: 'calc(var(--tab-bar-h) + var(--tray-bar-h) + env(safe-area-inset-bottom) + 0.5rem)',
      }}
    >
      <div
        role="status"
        className="pointer-events-auto mx-auto flex w-full max-w-[640px] items-center gap-3 rounded-md border border-border-strong bg-surface px-4 py-2 shadow-[var(--shadow-sheet)] motion-safe:animate-[sheet-in_200ms_var(--ease)]"
      >
        <span className="min-w-0 flex-1 truncate text-body">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="-mr-2 flex h-11 shrink-0 items-center rounded-md px-2 text-body font-semibold underline underline-offset-2"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
