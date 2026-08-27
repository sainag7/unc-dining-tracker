'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ItemSheet, type SheetContext } from './item-sheet';
import { MenuRow } from './menu-row';
import { Sheet } from './ui/sheet';
import { ChevronDown, Check, Search, Sliders, Close } from './ui/icons';
import { logFood, removeLog } from '@/app/actions';
import { FILTERABLE_PROPERTIES, propertyLabel } from '@/lib/labels';
import { orderStations, stationsToCollapse } from '@/lib/stations';
import { useStationOverrides, setStationOverrides } from '@/lib/station-prefs';
import type { RecipeRow } from '@/lib/supabase/database.types';
import type { StationWithItems } from '@/lib/menu';

interface Added {
  logId: number;
  label: string;
  recipeId: number;
}

export function MenuBrowser({
  stations: rawStations,
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Main courses lead, component bars sink. Done once, before filtering, so
  // search results and station groups share the same sequence.
  const stations = useMemo(() => orderStations(rawStations), [rawStations]);

  // Search and filters live in the URL so they survive a refresh and can be
  // shared, but the filtering itself stays local — see syncUrl.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [activeProps, setActiveProps] = useState<string[]>(() => {
    const fromUrl = searchParams.get('diet');
    if (fromUrl === null) return defaultFilters;
    return fromUrl ? fromUrl.split(',').filter((p) => FILTERABLE_PROPERTIES.includes(p as never)) : [];
  });

  const [searchOpen, setSearchOpen] = useState(() => (searchParams.get('q') ?? '') !== '');
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState<RecipeRow | null>(null);
  const [logged, setLogged] = useState<Record<number, number>>(loggedServings);
  const [added, setAdded] = useState<Added | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();


  /**
   * Mirrors search and filters into the URL.
   *
   * replaceState rather than router.replace: this is documented to sync with
   * useSearchParams without a server round-trip, so the list re-filters on
   * the keystroke instead of waiting for an RSC response.
   */
  const syncUrl = useCallback(
    (next: { q?: string; diet?: string[] }) => {
      const params = new URLSearchParams(searchParams.toString());

      const q = next.q ?? query;
      if (q.trim()) params.set('q', q);
      else params.delete('q');

      const diet = next.diet ?? activeProps;
      if (diet.length > 0) params.set('diet', diet.join(','));
      else params.delete('diet');

      const search = params.toString();
      window.history.replaceState(null, '', search ? `/?${search}` : '/');
    },
    [searchParams, query, activeProps],
  );

  // Which stations start closed, before the user's own overrides land.
  const defaultClosed = useMemo(() => stationsToCollapse(stations), [stations]);
  const overrides = useStationOverrides();

  const closed = useMemo(() => {
    const next = new Set(defaultClosed);
    for (const name of overrides.closed) next.add(name);
    for (const name of overrides.opened) next.delete(name);
    return next;
  }, [defaultClosed, overrides]);

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

    // Short, single pulse. Confirms the tap without announcing itself.
    navigator.vibrate?.(10);

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
        // The tray bar's total is resolved in the layout, so without this it
        // keeps showing the pre-add number until you navigate.
        router.refresh();
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
      if (result.ok) router.refresh();
      else setError(result.error ?? 'Could not undo that.');
    });
  }

  function toggleStation(name: string) {
    const isClosed = closed.has(name);
    const next = {
      opened: overrides.opened.filter((n) => n !== name),
      closed: overrides.closed.filter((n) => n !== name),
    };
    if (isClosed) next.opened.push(name);
    else next.closed.push(name);
    setStationOverrides(next);
  }

  function updateQuery(value: string) {
    setQuery(value);
    syncUrl({ q: value });
  }

  function updateFilters(next: string[]) {
    setActiveProps(next);
    syncUrl({ diet: next });
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
      <div className="mx-auto w-full max-w-[640px] px-4">
        <div className="flex items-center gap-2 py-2">
          {searchOpen ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="shrink-0 text-text-muted" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                placeholder="Search this menu"
                aria-label="Search this menu"
                className="field-underline min-w-0 flex-1 text-input placeholder:text-text-muted"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => {
                  updateQuery('');
                  setSearchOpen(false);
                }}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted"
              >
                <Close />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                aria-label="Search this menu"
                onClick={() => setSearchOpen(true)}
                className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted"
              >
                <Search />
              </button>

              <span className="flex-1" />

              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="-mr-2 flex h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-text-muted"
              >
                <Sliders />
                Filters
                {activeProps.length > 0 && (
                  <span className="data rounded-full bg-accent px-1.5 py-0.5 text-meta text-accent-fg">
                    {activeProps.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {activeProps.length > 0 && !searchOpen && (
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {activeProps.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateFilters(activeProps.filter((x) => x !== p))}
                aria-label={`Remove ${propertyLabel(p)} filter`}
                className="flex h-8 items-center gap-1 rounded-full border border-border-strong px-2.5 text-meta font-medium"
              >
                {propertyLabel(p)}
                <Close size={14} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => updateFilters([])}
              className="h-8 rounded-full px-2 text-meta font-medium text-accent-text"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {(added || error) && (
        <div
          role="status"
          className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3 border-b border-border px-4 pb-2 text-body"
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
                className="-mr-2 flex h-11 shrink-0 items-center rounded-md px-2 font-medium text-accent-text"
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}

      <div
        className="mx-auto w-full max-w-[640px] px-4"
        style={{ paddingBottom: 'calc(var(--tab-bar-h) + var(--tray-bar-h) + 2rem)' }}
      >
        {searching ? (
          searchResults.length === 0 ? (
            <EmptyState
              title="No matches"
              body={`Nothing on this menu matches “${query.trim()}”.`}
              actionLabel="Clear search"
              onAction={() => {
                updateQuery('');
                setSearchOpen(false);
              }}
            />
          ) : (
            <section className="mt-2">
              <StationHead title="Results" count={searchResults.length} />
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
              <section className="mt-2">
                <StationHead title="Your usuals" count={usuals.length} />
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
                body={`No items are ${activeProps.map(propertyLabel).join(' and ')}. Clearing the filters shows the whole menu.`}
                actionLabel="Clear filters"
                onAction={() => updateFilters([])}
              />
            ) : (
              visibleStations.map((station) => {
                const isClosed = closed.has(station.name);
                return (
                  <section key={station.name} className="mt-2">
                    <StationHead
                      title={station.name}
                      count={station.items.length}
                      collapsed={isClosed}
                      onToggle={() => toggleStation(station.name)}
                    />

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
        <Sheet
          label="Filters"
          onClose={() => setShowFilters(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => updateFilters([])}
                disabled={activeProps.length === 0}
                className="flex h-11 items-center rounded-md px-2 text-body font-medium text-accent-text disabled:opacity-40"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="on-accent h-11 rounded-md bg-accent px-6 text-body font-semibold text-accent-fg"
              >
                Show results
              </button>
            </div>
          }
        >
          <ul>
            {FILTERABLE_PROPERTIES.map((prop) => {
              const on = activeProps.includes(prop);
              return (
                <li key={prop}>
                  <button
                    type="button"
                    onClick={() =>
                      updateFilters(
                        on ? activeProps.filter((p) => p !== prop) : [...activeProps, prop],
                      )
                    }
                    aria-pressed={on}
                    className="flex w-full items-center justify-between gap-3 border-b border-border py-3 text-left"
                  >
                    <span className="text-input">{propertyLabel(prop)}</span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border transition-colors duration-150 ease-out ${
                        on
                          ? 'border-accent bg-accent text-accent-fg'
                          : 'border-border-strong text-transparent'
                      }`}
                    >
                      <Check size={16} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
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
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/**
 * The placard over the pan.
 *
 * Pins to the top of the viewport so the station you're looking at is always
 * named — the masthead scrolls away to leave room for it. `bg-bg` has to stay
 * opaque, since rows scroll underneath.
 *
 * One chevron carries the collapse state; the previous version put the count
 * and the word "hide" side by side, which read as two controls.
 */
function StationHead({
  title,
  count,
  collapsed,
  onToggle,
}: {
  title: string;
  count: number;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const inner = (
    <>
      <h2 className="placard min-w-0 truncate">{title}</h2>
      <span className="flex shrink-0 items-center gap-1.5 text-text-muted">
        <span className="data text-meta">{count}</span>
        {onToggle && (
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 ease-out ${collapsed ? '' : 'rotate-180'}`}
          />
        )}
      </span>
    </>
  );

  const className =
    'sticky top-0 z-10 flex w-full items-center justify-between gap-3 border-b border-text bg-bg py-2 text-left';

  if (!onToggle) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onToggle} aria-expanded={!collapsed} className={className}>
      {inner}
    </button>
  );
}

/**
 * An empty screen is an invitation to act, so each one carries the button
 * that resolves it rather than telling the reader what they could do.
 */
function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <p className="text-input font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-body text-text-muted">{body}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 h-11 rounded-md border border-border-strong px-5 text-body font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
