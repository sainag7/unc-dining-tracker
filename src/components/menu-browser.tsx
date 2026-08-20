'use client';

import { useMemo, useState } from 'react';
import { ItemSheet, type SheetContext } from './item-sheet';
import {
  FILTERABLE_PROPERTIES,
  allergenLabel,
  propertyLabel,
  conflictingAllergens,
} from '@/lib/labels';
import type { RecipeRow } from '@/lib/supabase/database.types';
import type { StationWithItems } from '@/lib/menu';

export function MenuBrowser({
  stations,
  context,
  defaultFilters = [],
}: {
  stations: StationWithItems[];
  context: SheetContext;
  /** Dietary preferences from the user's profile, pre-applied as Settings promises. */
  defaultFilters?: string[];
}) {
  const [query, setQuery] = useState('');
  const [activeProps, setActiveProps] = useState<string[]>(defaultFilters);
  const [selected, setSelected] = useState<RecipeRow | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return stations
      .map((station) => ({
        ...station,
        items: station.items.filter((item) => {
          if (q && !item.name.toLowerCase().includes(q)) return false;
          return activeProps.every((p) => item.properties.includes(p));
        }),
      }))
      .filter((station) => station.items.length > 0);
  }, [stations, query, activeProps]);

  const matchCount = filtered.reduce((n, s) => n + s.items.length, 0);
  const isFiltering = query.trim() !== '' || activeProps.length > 0;

  function toggleProp(prop: string) {
    setActiveProps((current) =>
      current.includes(prop) ? current.filter((p) => p !== prop) : [...current, prop],
    );
  }

  function toggleStation(name: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur">
        <label className="sr-only" htmlFor="menu-search">
          Search this menu
        </label>
        <input
          id="menu-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this menu"
          className="w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-base placeholder:text-ink-faint"
        />

        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
          {FILTERABLE_PROPERTIES.map((prop) => {
            const on = activeProps.includes(prop);
            return (
              <button
                key={prop}
                type="button"
                onClick={() => toggleProp(prop)}
                aria-pressed={on}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                  on
                    ? 'bg-navy text-paper-raised'
                    : 'border border-rule bg-paper-raised text-ink-soft'
                }`}
              >
                {propertyLabel(prop)}
              </button>
            );
          })}
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveProps([]);
              }}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-soft underline"
            >
              Clear
            </button>
          )}
        </div>

        {isFiltering && (
          <p className="mt-1.5 text-xs text-ink-soft" role="status">
            {matchCount} {matchCount === 1 ? 'item' : 'items'} match
          </p>
        )}
      </div>

      {justLogged && (
        <p
          role="status"
          className="mx-4 mt-3 rounded-lg border border-carolina bg-carolina/10 px-3 py-2 text-sm font-medium text-navy"
        >
          Added {justLogged}.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="signage text-xl text-ink-soft">Nothing matches</p>
          <p className="mt-1 text-sm text-ink-soft">
            Try a different search, or clear your filters to see the whole menu.
          </p>
        </div>
      ) : (
        <div className="px-4 pb-32">
          {filtered.map((station) => {
            const isCollapsed = collapsed.has(station.name);
            return (
              <section key={station.name} className="mt-5">
                <button
                  type="button"
                  onClick={() => toggleStation(station.name)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-baseline justify-between gap-3 border-b-2 border-rule-strong pb-1 text-left"
                >
                  <h2 className="signage text-lg">{station.name}</h2>
                  <span className="data shrink-0 text-xs text-ink-soft">
                    {station.items.length} {isCollapsed ? '▸' : '▾'}
                  </span>
                </button>

                {!isCollapsed && (
                  <ul>
                    {station.items.map((item, i) => {
                      const conflicts = conflictingAllergens(
                        item.allergens,
                        context.allergensAvoid,
                      );
                      return (
                        <li key={`${item.id}-${i}`}>
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            className="flex w-full items-center justify-between gap-3 border-b border-rule py-2.5 text-left hover:bg-paper-sunk"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] leading-snug">
                                {item.name}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                {conflicts.length > 0 && (
                                  <span className="text-xs font-semibold text-danger">
                                    ⚠ {conflicts.map(allergenLabel).join(', ')}
                                  </span>
                                )}
                                {item.properties.slice(0, 3).map((p) => (
                                  <span key={p} className="text-xs text-ink-soft">
                                    {propertyLabel(p)}
                                  </span>
                                ))}
                              </span>
                            </span>

                            <span className="shrink-0 text-right">
                              <span className="data block text-base font-semibold leading-none">
                                {item.calories === null ? '—' : Math.round(item.calories)}
                              </span>
                              <span className="text-[10px] uppercase tracking-wide text-ink-faint">
                                cal
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selected && (
        <ItemSheet
          recipe={selected}
          context={context}
          onClose={() => setSelected(null)}
          onLogged={(recipe, servings) => {
            setJustLogged(`${servings}× ${recipe.name}`);
            window.setTimeout(() => setJustLogged(null), 4000);
          }}
        />
      )}
    </>
  );
}
