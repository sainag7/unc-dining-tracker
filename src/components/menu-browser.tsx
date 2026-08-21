'use client';

import { useMemo, useState, useTransition } from 'react';
import { ItemSheet, type SheetContext } from './item-sheet';
import { MenuRow } from './menu-row';
import { logFood, removeLog } from '@/app/actions';
import { FILTERABLE_PROPERTIES, propertyLabel } from '@/lib/labels';
import { stationsToCollapse } from '@/lib/stations';
import type { RecipeRow } from '@/lib/supabase/database.types';
import type { StationWithItems } from '@/lib/menu';

interface Added {
  logId: number;
  label: string;
  recipeId: number;
}

export function MenuBrowser({
  stations,
  context,
  defaultFilters = [],
  loggedServings,
  usualIds = [],
}: {
  stations: StationWithItems[];
  context: SheetContext;
  /** Dietary preferences from the user's profile, pre-applied. */
  defaultFilters?: string[];
  /** Servings already logged for the viewed date, by recipe id. */
  loggedServings: Record<number, number>;
  /** Recipe ids this user usually eats at this hall and meal period. */
  usualIds?: number[];
}) {
  const [query, setQuery] = useState('');
  const [activeProps, setActiveProps] = useState<string[]>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState<RecipeRow | null>(null);
  const [logged, setLogged] = useState<Record<number, number>>(loggedServings);
  const [added, setAdded] = useState<Added | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Which stations start closed. Computed once per menu, then owned by the user.
  const [closed, setClosed] = useState<Set<string>>(() => stationsToCollapse(stations));

  const matchesFilters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (item: RecipeRow) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return activeProps.every((p) => item.properties.includes(p));
    };
  }, [query, activeProps]);

  const searching = query.trim() !== '';

  /** Flat matches across every station, including closed ones. */
  const searchResults = useMemo(() => {
    if (!searching) return [];
    return stations.flatMap((station) =>
      station.items.filter(matchesFilters).map((item) => ({ item, station: station.name })),
    );
  }, [searching, stations, matchesFilters]);

  const visibleStations = useMemo(
    () =>
      stations
        .map((s) => ({ ...s, items: s.items.filter(matchesFilters) }))
        .filter((s) => s.items.length > 0),
    [stations, matchesFilters],
  );

  const usuals = useMemo(() => {
    if (usualIds.length === 0 || searching) return [];
    const byId = new Map<number, RecipeRow>();
    for (const station of stations) {
      for (const item of station.items) if (!byId.has(item.id)) byId.set(item.id, item);
    }
    return usualIds.map((id) => byId.get(id)).filter((r): r is RecipeRow => Boolean(r));
  }, [usualIds, stations, searching]);

  function quickAdd(item: RecipeRow) {
    setError(null);
    // Move the count first; the write follows. A failure puts it back.
    setLogged((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }));

    startTransition(async () => {
      const result = await logFood({
        recipeId: item.id,
        servings: 1,
        serviceDate: context.serviceDate,
        mealPeriodName: context.mealPeriodName,
        hallId: context.hallId,
      });

      if (result.ok && result.logId) {
        setAdded({ logId: result.logId, label: item.name, recipeId: item.id });
      } else {
        setLogged((current) => ({
          ...current,
          [item.id]: Math.max(0, (current[item.id] ?? 1) - 1),
        }));
        setError(result.error ?? 'Could not save that.');
      }
    });
  }

  function undo(entry: Added) {
    setAdded(null);
    setLogged((current) => ({
      ...current,
      [entry.recipeId]: Math.max(0, (current[entry.recipeId] ?? 1) - 1),
    }));
    startTransition(async () => {
      const result = await removeLog(entry.logId);
      if (!result.ok) setError(result.error ?? 'Could not undo that.');
    });
  }

  function toggleStation(name: string) {
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const rowProps = (item: RecipeRow) => ({
    item,
    servings: logged[item.id] ?? 0,
    allergensAvoid: context.allergensAvoid,
    isSignedIn: context.isSignedIn,
    onQuickAdd: () => quickAdd(item),
    onOpenDetail: () => setDetail(item),
  });

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-rule bg-paper/95 px-4 pt-2 pb-1 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this menu"
            aria-label="Search this menu"
            className="field-underline min-w-0 flex-1 text-[0.9375rem] placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="shrink-0 pb-2 text-xs text-carolina"
          >
            Filters{activeProps.length > 0 ? ` (${activeProps.length})` : ''}
          </button>
        </div>

        {activeProps.length > 0 && (
          <p className="mt-1 text-xs text-ink-soft">
            Showing {activeProps.map(propertyLabel).join(' · ')} only
          </p>
        )}
      </div>

      {(added || error) && (
        <div
          role="status"
          className="mx-4 mt-2 flex items-center justify-between gap-3 border-b border-rule pb-2 text-sm"
        >
          {error ? (
            <span className="font-medium text-danger">{error}</span>
          ) : (
            <>
              <span className="min-w-0 truncate">
                Added <span className="font-semibold">{added!.label}</span>
              </span>
              <button
                type="button"
                onClick={() => undo(added!)}
                className="shrink-0 text-carolina underline underline-offset-2"
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}

      <div className="px-4" style={{ paddingBottom: 'calc(var(--tab-bar-h) + 3rem)' }}>
        {searching ? (
          searchResults.length === 0 ? (
            <EmptyState
              title="No matches"
              body={`Nothing on this menu matches “${query.trim()}”.`}
            />
          ) : (
            <section className="mt-4">
              <SectionHead title="Results" count={searchResults.length} />
              <ul>
                {searchResults.map(({ item, station }, i) => (
                  <MenuRow key={`${item.id}-${i}`} {...rowProps(item)} stationLabel={station} />
                ))}
              </ul>
            </section>
          )
        ) : (
          <>
            {usuals.length > 0 && (
              <section className="mt-4">
                <SectionHead title="Your usuals" count={usuals.length} />
                <ul>
                  {usuals.map((item) => (
                    <MenuRow key={`usual-${item.id}`} {...rowProps(item)} />
                  ))}
                </ul>
              </section>
            )}

            {visibleStations.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                body="Clear your filters to see the whole menu."
              />
            ) : (
              visibleStations.map((station) => {
                const isClosed = closed.has(station.name);
                return (
                  <section key={station.name} className="mt-4">
                    <button
                      type="button"
                      onClick={() => toggleStation(station.name)}
                      aria-expanded={!isClosed}
                      className="flex w-full items-baseline justify-between gap-3 rule-top pt-1.5 pb-1 text-left"
                    >
                      <h2 className="signage text-[0.9375rem]">{station.name}</h2>
                      <span className="data shrink-0 text-xs text-ink-soft">
                        {station.items.length}
                        <span className="ml-1.5 text-ink-faint">
                          {isClosed ? 'show' : 'hide'}
                        </span>
                      </span>
                    </button>

                    {!isClosed && (
                      <ul>
                        {station.items.map((item, i) => (
                          <MenuRow key={`${item.id}-${i}`} {...rowProps(item)} />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
          </>
        )}
      </div>

      {showFilters && (
        <FilterSheet
          active={activeProps}
          onToggle={(prop) =>
            setActiveProps((current) =>
              current.includes(prop)
                ? current.filter((p) => p !== prop)
                : [...current, prop],
            )
          }
          onClear={() => setActiveProps([])}
          onClose={() => setShowFilters(false)}
        />
      )}

      {detail && (
        <ItemSheet
          recipe={detail}
          context={context}
          servingsToday={logged[detail.id] ?? 0}
          onClose={() => setDetail(null)}
          onLogged={(recipe, servings, logId) => {
            setLogged((current) => ({
              ...current,
              [recipe.id]: (current[recipe.id] ?? 0) + servings,
            }));
            if (logId) setAdded({ logId, label: recipe.name, recipeId: recipe.id });
          }}
        />
      )}
    </>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rule-top pt-1.5 pb-1">
      <h2 className="signage text-[0.9375rem]">{title}</h2>
      <span className="data shrink-0 text-xs text-ink-soft">{count}</span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-16 text-center">
      <p className="signage text-lg text-ink-soft">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">{body}</p>
    </div>
  );
}

function FilterSheet({
  active,
  onToggle,
  onClear,
  onClose,
}: {
  active: string[];
  onToggle: (prop: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="relative w-full max-w-lg bg-paper p-4 pb-8 shadow-[var(--shadow-sheet)]"
      >
        <div className="flex items-baseline justify-between rule-top pt-2">
          <h2 className="signage text-lg">Filters</h2>
          <button type="button" onClick={onClose} className="text-sm text-carolina">
            Done
          </button>
        </div>

        <ul className="mt-2">
          {FILTERABLE_PROPERTIES.map((prop) => {
            const on = active.includes(prop);
            return (
              <li key={prop}>
                <button
                  type="button"
                  onClick={() => onToggle(prop)}
                  aria-pressed={on}
                  className="flex w-full items-center justify-between border-b border-rule py-3 text-left"
                >
                  <span className="text-[0.9375rem]">{propertyLabel(prop)}</span>
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 items-center justify-center border ${
                      on ? 'border-carolina bg-carolina text-paper-raised' : 'border-rule-strong'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {active.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="mt-3 text-sm text-carolina underline underline-offset-2"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
