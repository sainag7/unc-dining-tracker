import { useSyncExternalStore } from 'react';

/**
 * Which stations the user has explicitly opened or closed.
 *
 * Only the overrides are stored, never the full closed set — that way
 * `stationsToCollapse` keeps making the call for stations the user has never
 * touched, including ones appearing on a menu for the first time.
 *
 * This is a store rather than component state because it has to be read
 * during render without a hydration mismatch: the server has no localStorage,
 * so it gets an empty snapshot and the client swaps in the real one.
 */
export type StationOverrides = { opened: string[]; closed: string[] };

const KEY = 'tray.stations.v1';
const EMPTY: StationOverrides = { opened: [], closed: [] };

const listeners = new Set<() => void>();

// getSnapshot must return a stable reference until the data actually changes,
// or useSyncExternalStore will loop.
let cachedRaw: string | null = null;
let cached: StationOverrides = EMPTY;

function parse(raw: string | null): StationOverrides {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<StationOverrides>;
    return {
      opened: Array.isArray(value.opened) ? value.opened : [],
      closed: Array.isArray(value.closed) ? value.closed : [],
    };
  } catch {
    return EMPTY;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keeps two tabs in step.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): StationOverrides {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Private mode, or storage is disabled. Defaults still work.
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

const getServerSnapshot = (): StationOverrides => EMPTY;

export function useStationOverrides(): StationOverrides {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setStationOverrides(next: StationOverrides) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not worth surfacing — the toggle still works for this session.
  }
  for (const listener of listeners) listener();
}
