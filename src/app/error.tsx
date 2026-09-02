'use client';

import { Button, ButtonLink } from '@/components/ui/button';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-input font-semibold">That didn&rsquo;t load</h1>
      <p className="mt-2 max-w-sm text-body text-text-muted">
        Something went wrong fetching the menu. Try again — if it keeps happening, the menu
        data may still be syncing.
      </p>
      <div className="mt-6 flex gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary">
          Back to the menu
        </ButtonLink>
      </div>
    </main>
  );
}
