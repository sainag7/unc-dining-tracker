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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] leading-snug">{entry.recipeName}</p>
          <p className="text-xs text-ink-soft">
            <span className="data">{entry.servings}×</span>
            {entry.servingSize ? ` ${entry.servingSize}` : ' serving'}
            {entry.hallName ? ` · ${entry.hallName.replace(' Dining Hall', '')}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <span className="data block text-base font-semibold leading-none">{calories}</span>
            <span className="data text-[10px] text-ink-faint">{protein}g P</span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            aria-expanded={editing}
            className="rounded-lg border border-rule px-2 py-1 text-xs text-ink-soft"
          >
            Edit
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-2 rounded-lg bg-paper-sunk p-2">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {SERVING_STEPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => change(s)}
                disabled={pending}
                aria-pressed={s === entry.servings}
                className={`data h-9 shrink-0 rounded-lg px-3 text-sm ${
                  s === entry.servings
                    ? 'bg-navy text-paper-raised'
                    : 'border border-rule bg-paper-raised text-ink-soft'
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
            className="mt-2 text-sm font-medium text-danger underline"
          >
            Remove from today
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
      <div className="px-4 py-14 text-center">
        <p className="signage text-xl text-ink-soft">Nothing logged yet</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
          Open the menu and tap what you ate. It&rsquo;ll show up here.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-paper-raised"
        >
          Go to the menu
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
    <div className="px-4">
      {[...groups].map(([period, items]) => {
        const subtotal = items.reduce(
          (n, e) => n + (e.calories_snapshot ?? 0) * e.servings,
          0,
        );
        return (
          <section key={period} className="mt-5">
            <div className="flex items-baseline justify-between border-b-2 border-rule-strong pb-1">
              <h2 className="signage text-lg">{period}</h2>
              <span className="data text-xs text-ink-soft">{Math.round(subtotal)} cal</span>
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
