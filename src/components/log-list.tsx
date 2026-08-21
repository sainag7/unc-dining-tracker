'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { updateServings, removeLog } from '@/app/actions';
import type { LogEntry } from '@/lib/log';

const SERVING_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4];

function EntryRow({ entry }: { entry: LogEntry }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const calories = Math.round((entry.calories_snapshot ?? 0) * entry.servings);
  const protein = Math.round((entry.protein_snapshot ?? 0) * entry.servings);

  const change = (servings: number) =>
    startTransition(async () => {
      const result = await updateServings(entry.id, servings);
      if (!result.ok) setError(result.error ?? 'Could not update that.');
      else setEditing(false);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await removeLog(entry.id);
      if (!result.ok) setError(result.error ?? 'Could not remove that.');
    });

  return (
    <li className={`border-b border-rule py-2.5 ${pending ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={() => setEditing(!editing)}
        aria-expanded={editing}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[0.9375rem] leading-snug">{entry.recipeName}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-faint">
            <span className="data">{entry.servings}×</span>
            {entry.servingSize ? ` ${entry.servingSize}` : ' serving'}
            {entry.hallName ? ` · ${entry.hallName.replace(/\s*dining hall\s*/i, '')}` : ''}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="data block text-sm font-semibold leading-none">{calories}</span>
          <span className="data mt-0.5 block text-[10px] text-ink-faint">{protein}g P</span>
        </span>
      </button>

      {editing && (
        <div className="mt-2">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {SERVING_STEPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => change(s)}
                disabled={pending}
                aria-pressed={s === entry.servings}
                className={`data h-10 w-13 shrink-0 border px-3 text-sm ${
                  s === entry.servings
                    ? 'border-carolina bg-carolina text-paper-raised'
                    : 'border-rule text-ink-soft'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="mt-2 text-xs text-danger underline underline-offset-2"
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

export function LogList({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="signage text-lg text-ink-soft">Nothing logged</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
          Open Menus and tap the <span aria-hidden>+</span> next to anything you ate.
        </p>
        <Link
          href="/"
          className="signage mt-5 inline-block bg-navy px-6 py-2.5 text-sm text-paper-raised"
        >
          Go to menus
        </Link>
      </div>
    );
  }

  // Grouped by meal period so the day reads in the order it happened.
  const groups = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const key = entry.meal_period_name ?? 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return (
    <div>
      {[...groups].map(([period, items]) => {
        const subtotal = items.reduce((n, e) => n + (e.calories_snapshot ?? 0) * e.servings, 0);
        return (
          <section key={period} className="mt-5">
            <div className="flex items-baseline justify-between gap-3 rule-top pt-1.5 pb-1">
              <h2 className="signage text-[0.9375rem]">{period}</h2>
              <span className="data shrink-0 text-xs text-ink-soft">
                {Math.round(subtotal)} cal
              </span>
            </div>
            <ul>
              {items.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
