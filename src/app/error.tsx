'use client';

import Link from 'next/link';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-input font-semibold">That didn&rsquo;t load</h1>
      <p className="mt-2 max-w-sm text-body text-text-muted">
        Something went wrong fetching the menu. Try again — if it keeps happening, the menu
        data may still be syncing.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="on-accent inline-flex h-11 items-center rounded-md bg-accent px-5 text-body font-semibold text-accent-fg"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-md border border-border-strong px-5 text-body font-medium"
        >
          Back to the menu
        </Link>
      </div>
    </main>
  );
}
