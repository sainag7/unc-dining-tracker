'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ItemSheet, type SheetContext } from './item-sheet';
import { MenuRow } from './menu-row';
import { useTray } from './tray-provider';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';
import { ChevronDown, Check, Search, Sliders, Close, ArrowsSort } from './ui/icons';
import { logFood, removeServing } from '@/app/actions';
import { FILTERABLE_PROPERTIES, propertyLabel } from '@/lib/labels';
import { orderStations, stationsToCollapse } from '@/lib/stations';
import { applySort, nextSortMode, parseSortMode, sortLabel, type SortMode } from '@/lib/sort';
import { useStationOverrides, setStationOverrides } from '@/lib/station-prefs';
import type { RecipeRow } from '@/lib/supabase/database.types';
import type { StationWithItems } from '@/lib/menu';

/** Spoken form of each sort mode, for the button's accessible name. */
const SORT_DESCRIPTION: Record<SortMode, string> = {
  station: 'grouped by station',
  'cal-asc': 'sorted by calories, lowest first',
  'cal-desc': 'sorted by calories, highest first',
};

export function MenuBrowser({
  stations: rawStations,
  context,
  defaultFilters = [],
  loggedServings,
}: {
  stations: StationWithItems[];
  context: SheetContext;
  /** Dietary preferences from the user's profile, pre-applied. */
  defaultFilters?: string[];
  /** Servings already logged for the viewed date, by recipe id. */
  loggedServings: Record<number, number>;
}) {
  const router = useRouter();
  // Null when signed out, where there is no tray bar to move.
  const tray = useTray();
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

  const [sortMode, setSortMode] = useState<SortMode>(() => parseSortMode(searchParams.get('sort')));
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState<RecipeRow | null>(null);
  const [logged, setLogged] = useState<Record<number, number>>(loggedServings);
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
    (next: { q?: string; diet?: string[]; sort?: SortMode }) => {
      const params = new URLSearchParams(searchParams.toString());

      const q = next.q ?? query;
      if (q.trim()) params.set('q', q);
      else params.delete('q');

      const diet = next.diet ?? activeProps;
      if (diet.length > 0) params.set('diet', diet.join(','));
      else params.delete('diet');

      const sort = next.sort ?? sortMode;
      if (sort !== 'station') params.set('sort', sort);
      else params.delete('sort');

      const search = params.toString();
      window.history.replaceState(null, '', search ? `/?${search}` : '/');
    },
    [searchParams, query, activeProps, sortMode],
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

  const visibleStations = useMemo(() => {
    const filtered = stations
      .map((s) => ({ ...s, items: s.items.filter(matchesFilters) }))
      .filter((s) => s.items.length > 0);

    // Sorting by calories collapses the station grouping into one ranking —
    // twenty-two separately-sorted lists would not answer "what's light here".
    return applySort(filtered, sortMode);
  }, [stations, matchesFilters, sortMode]);

  // Station collapse is meaningless once there is only one synthetic station,
  // and search results are already flat.
  const grouped = sortMode === 'station';

  function quickAdd(item: RecipeRow) {
    setError(null);
    // Move the count first; the write follows. A failure puts it back.
    setLogged((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }));

    // Short, single pulse. Confirms the tap without announcing itself.
    navigator.vibrate?.(10);

    startTransition(async () => {
      /*
        Move the tray now, inside the transition and before the await. The
        calories are already on the row that was tapped — none of this needs
        the server. React holds the delta until the refresh below replaces the
        base value, and drops it on its own if the write fails.

        A first helping adds a line to the tray; a second only adds calories
        to a line that is already there.
      */
      tray?.adjust({
        calories: item.calories ?? 0,
        protein: item.protein_g ?? 0,
        lines: (logged[item.id] ?? 0) === 0 ? 1 : 0,
      });

      const result = await logFood({
        recipeId: item.id,
        servings: 1,
        serviceDate: context.serviceDate,
        mealPeriodName: context.mealPeriodName,
        hallId: context.hallId,
      });

      if (result.ok) {
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

  function quickRemove(item: RecipeRow) {
    setError(null);
    setLogged((current) => ({
      ...current,
      [item.id]: Math.max(0, (current[item.id] ?? 0) - 1),
    }));

    navigator.vibrate?.(10);

    startTransition(async () => {
      // Taking the last serving off deletes the line, so the count drops with
      // it; taking one off a stack of three only moves the macros.
      tray?.adjust({
        calories: -(item.calories ?? 0),
        protein: -(item.protein_g ?? 0),
        lines: (logged[item.id] ?? 0) <= 1 ? -1 : 0,
      });

      const result = await removeServing({
        recipeId: item.id,
        serviceDate: context.serviceDate,
        mealPeriodName: context.mealPeriodName,
        hallId: context.hallId,
      });

      if (result.ok) {
        // A part serving comes off by less than the 1 assumed above — settle up
        // before the refresh so the count never shows a wrong number at all.
        const removed = result.removed ?? 1;
        if (removed !== 1) {
          setLogged((current) => ({
            ...current,
            [item.id]: Math.max(0, (current[item.id] ?? 0) + 1 - removed),
          }));
        }
        router.refresh();
      } else {
        setLogged((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }));
        setError(result.error ?? 'Could not remove that.');
      }
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

  function updateSort(next: SortMode) {
    setSortMode(next);
    syncUrl({ sort: next });
  }

  const rowProps = (item: RecipeRow) => ({
    item,
    servings: logged[item.id] ?? 0,
    allergensAvoid: context.allergensAvoid,
    isSignedIn: context.isSignedIn,
    onQuickAdd: () => quickAdd(item),
    onQuickRemove: () => quickRemove(item),
    onOpenDetail: () => setDetail(item),
  });

  return (
    <>
      <div className="mx-auto w-full max-w-[640px] px-4">
        {/*
          One row, always in this shape. The field used to collapse to an icon
          below sm, which spent a 60px band on a button that hid the thing it
          opened — and the Filters control only existed in that collapsed
          branch, so above sm there was no way into the filter sheet at all.
        */}
        <div className="flex items-center gap-2 py-2">
          <div className="card flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full px-4">
            <Search size={16} className="shrink-0 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search this menu"
              // 16px, not the 14px the rest of the row uses: anything smaller
              // makes iOS zoom the page when the field takes focus.
              className="min-w-0 flex-1 bg-transparent text-input outline-none placeholder:text-text-muted"
            />
            {query !== '' && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => updateQuery('')}
                className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-alt text-text-muted"
              >
                <Close size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => updateSort(nextSortMode(sortMode))}
            aria-label={`Sort by calories. Currently ${SORT_DESCRIPTION[sortMode]}.`}
            className={`card flex h-12 shrink-0 items-center gap-1 rounded-full px-3.5 text-row font-semibold ${
              sortMode === 'station' ? 'text-text-mid' : 'text-accent-text'
            }`}
          >
            <ArrowsSort size={16} />
            {sortLabel(sortMode)}
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label={
              activeProps.length > 0
                ? `Filters. ${activeProps.length} active.`
                : 'Filters'
            }
            className={`card flex h-12 shrink-0 items-center gap-1 rounded-full px-3.5 text-row font-semibold ${
              activeProps.length > 0 ? 'text-accent-text' : 'text-text-mid'
            }`}
          >
            <Sliders size={16} />
            {/* The count sits inline, not in a pill of its own. A bordered
                badge beside an icon is two shapes saying one number. */}
            {activeProps.length > 0 && <span className="data">{activeProps.length}</span>}
          </button>
        </div>

        {activeProps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {activeProps.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateFilters(activeProps.filter((x) => x !== p))}
                aria-label={`Remove ${propertyLabel(p)} filter`}
                className="card flex h-8 items-center gap-1 rounded-full px-3 text-meta font-semibold"
              >
                {propertyLabel(p)}
                <Close size={14} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => updateFilters([])}
              className="h-8 rounded-full px-2 text-meta font-semibold text-accent-text"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/*
        An error is worth a line in the layout; a confirmation is not. This
        band used to carry an "Added X · Undo" line too, so every single add
        pushed the whole list down 53px and the row you were aiming at moved
        out from under your thumb. The confirmation is now the row's own
        state — it tints and shows a count — which needs no space of its own
        and doesn't expire.
      */}
      {error && (
        <div
          role="alert"
          className="mx-auto w-full max-w-[640px] px-4 pb-2"
        >
          <p className="rounded-[var(--radius-md)] bg-danger-bg px-4 py-2.5 text-body font-semibold text-danger">
            {error}
          </p>
        </div>
      )}

      {/*
        No background of its own any more — --bg shows between the station
        cards, which is what makes them read as separate objects rather than
        as sections of one long sheet.
      */}
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
              onAction={() => updateQuery('')}
            />
          ) : (
            <section className="card mt-3">
              <StationHead title="Results" count={searchResults.length} />
              <ul className="overflow-hidden rounded-b-[var(--radius-xl)]">
                {searchResults.map(({ item, station }, i) => (
                  <MenuRow key={`${item.id}-${i}`} {...rowProps(item)} stationLabel={station} />
                ))}
              </ul>
            </section>
          )
        ) : (
          visibleStations.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              body={`No items are ${activeProps.map(propertyLabel).join(' and ')}. Clearing the filters shows the whole menu.`}
              actionLabel="Clear filters"
              onAction={() => updateFilters([])}
            />
          ) : (
            visibleStations.map((station) => {
              const isClosed = grouped && closed.has(station.name);
              return (
                <section key={station.name} className="card mt-3">
                  <StationHead
                    title={station.name}
                    count={station.items.length}
                    collapsed={isClosed}
                    onToggle={grouped ? () => toggleStation(station.name) : undefined}
                  />

                  {!isClosed && (
                    // The clip lives here rather than on the <section> on
                    // purpose: overflow-hidden on an ancestor kills position:
                    // sticky, and StationHead above is sticky. On the <ul> it
                    // rounds the last row's tint into the card corner and
                    // leaves the header free to pin.
                    <ul className="overflow-hidden rounded-b-[var(--radius-xl)]">
                      {station.items.map((item, i) => (
                        <MenuRow key={`${item.id}-${i}`} {...rowProps(item)} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )
        )}
      </div>

      {showFilters && (
        <Sheet
          label="Filters"
          onClose={() => setShowFilters(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => updateFilters([])}
                disabled={activeProps.length === 0}
              >
                Clear all
              </Button>
              <Button type="button" onClick={() => setShowFilters(false)}>
                Show results
              </Button>
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
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ease-out ${
                        on
                          ? 'bg-accent text-accent-fg'
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
          onLogged={(recipe, servings) => {
            setLogged((current) => ({
              ...current,
              [recipe.id]: (current[recipe.id] ?? 0) + servings,
            }));
            router.refresh();
          }}
        />
      )}

    </>
  );
}

/**
 * The placard over the pan, and the top of its card.
 *
 * Pins to the top of the viewport so the station you're looking at is always
 * named — the masthead scrolls away to leave room for it. The background has
 * to stay opaque, since rows scroll underneath.
 *
 * One chevron carries the collapse state; an earlier version put the count
 * and the word "hide" side by side, which read as two controls.
 */
function StationHead({
  title,
  count,
  collapsed,
  onToggle,
}: {
  title: string;
  /** Omitted for sections where a tally would read as inventory. */
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const inner = (
    <>
      <h2 className="section-label min-w-0 truncate text-text">{title}</h2>
      <span className="flex shrink-0 items-center gap-1.5 text-text-mid">
        {count !== undefined && <span className="data text-micro">{count}</span>}
        {/* One chevron, on the right, next to the count — not a count on each
            side of the row. */}
        {onToggle && (
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${
              collapsed ? '' : 'rotate-180'
            }`}
          />
        )}
      </span>
    </>
  );

  // No longer a full-bleed band: the card edge is the boundary now, so the
  // header just takes the card's top corners. Still sticky, so the placard
  // stays readable while the pan's contents scroll past — the masthead is
  // deliberately not sticky to leave room for exactly this.
  //
  // Collapsed, the card is nothing but this header, so it rounds on all four
  // corners and drops the divider it would otherwise draw against row one.
  const className = `sticky top-0 z-10 flex w-full items-center justify-between gap-3 rounded-t-[var(--radius-xl)] bg-surface px-4 py-3 text-left ${
    collapsed ? 'rounded-b-[var(--radius-xl)]' : 'hairline-b'
  }`;

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
        <Button type="button" variant="secondary" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
