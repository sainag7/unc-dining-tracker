'use client';

import Link from 'next/link';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="signage text-xl">That didn&rsquo;t load</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        Something went wrong fetching the menu. Try again — if it keeps happening, the menu
        data may still be syncing.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="signage bg-navy px-6 py-2.5 text-sm text-paper-raised"
        >
          Try again
        </button>
        <Link
          href="/"
          className="signage border-2 border-rule-strong px-6 py-2.5 text-sm"
        >
          Back to the menu
        </Link>
      </div>
    </main>
  );
}
