'use client';

import { useState, useTransition } from 'react';
import { deleteAccount } from '@/app/settings/actions';

/**
 * Two taps, not a browser confirm(): the second button only appears after the
 * first, and says exactly what goes. Deleting is permanent — there's no undo
 * toast for this one.
 */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="-ml-1 flex h-11 items-center rounded-full px-4 text-body font-semibold text-danger"
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-body text-text-muted">
        This deletes your account, your goals and every meal you&apos;ve logged. It can&apos;t be
        undone.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAccount();
              if (!result.ok) setError(result.error ?? 'Could not delete your account.');
            })
          }
          className="flex h-11 items-center rounded-full bg-danger-bg px-4 text-body font-semibold text-danger"
        >
          {pending ? 'Deleting…' : 'Delete everything'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="card flex h-11 items-center rounded-full px-4 text-body text-text-muted"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-body font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
