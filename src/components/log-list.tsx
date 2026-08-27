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
    <li className={`border-b border-border py-2 transition-opacity duration-150 ease-out ${pending ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={() => setEditing(!editing)}
        aria-expanded={editing}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-body">{entry.recipeName}</span>
          <span className="mt-0.5 block truncate text-meta text-text-muted">
            <span className="data">{entry.servings}×</span>
            {entry.servingSize ? ` ${entry.servingSize}` : ' serving'}
            {entry.hallName ? ` · ${entry.hallName.replace(/\s*dining hall\s*/i, '')}` : ''}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="data block text-body font-semibold">{calories}</span>
          <span className="data mt-0.5 block text-meta text-text-muted">{protein}g P</span>
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
                className={`data on-accent h-11 w-14 shrink-0 rounded-sm border text-body transition-colors duration-150 ease-out ${
                  s === entry.servings
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border text-text-muted'
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
            className="-ml-2 mt-1 flex h-11 items-center rounded-md px-2 text-body font-medium text-danger"
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-meta font-medium text-danger">
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
        <p className="text-input font-semibold">Nothing logged yet</p>
        <p className="mx-auto mt-1 max-w-xs text-body text-text-muted">
          Tap the add button next to anything on a menu and it lands here.
        </p>
        <Link
          href="/"
          className="on-accent mt-5 inline-flex h-11 items-center rounded-md bg-accent px-5 text-body font-semibold text-accent-fg"
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
          <section key={period} className="mt-4">
            <div className="flex items-center justify-between gap-3 border-b border-text py-2">
              <h2 className="placard">{period}</h2>
              <span className="data shrink-0 text-meta text-text-muted">
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
