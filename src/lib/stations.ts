import type { StationWithItems } from './menu';

/**
 * Self-serve component bars, as opposed to stations that serve dishes.
 *
 * Measured across every station name in the database: Salad Bar averages 41
 * items, Deli 35, Beverages 33. On a Chase dinner these are 165 of the 272
 * items on the menu — scrolling past them to reach the food is the single
 * worst thing about browsing a full menu.
 */
const COMPONENT_STATIONS = [
  'salad bar',
  'deli',
  'beverage',
  'condiment',
  'cereal',
  'bagels',
  'breads',
  'stress less',
  'hummus bar',
];

/**
 * No station of actual dishes runs this long. Acts as the safety net for bars
 * UNC adds or renames after this list was written.
 */
const LARGE_STATION = 20;

function isComponentStation(station: StationWithItems): boolean {
  const name = station.name.toLowerCase();
  return (
    COMPONENT_STATIONS.some((pattern) => name.includes(pattern)) ||
    station.items.length > LARGE_STATION
  );
}

/**
 * Decides which stations open collapsed so the menu leads with food.
 *
 * Collapsing is never destructive: a collapsed station still renders as a
 * header row with its name and item count, so it reads as an index entry
 * rather than something hidden. A wrong guess costs the user one tap.
 *
 * Returns the set of station names to collapse.
 */
export function stationsToCollapse(stations: StationWithItems[]): Set<string> {
  const collapse = new Set(
    stations.filter(isComponentStation).map((station) => station.name),
  );

  // If everything looked like a component bar, the rule has misfired for this
  // menu. Open the smallest few rather than presenting a wall of closed rows.
  if (stations.length > 0 && collapse.size === stations.length) {
    const smallest = [...stations]
      .sort((a, b) => a.items.length - b.items.length)
      .slice(0, 3);
    for (const station of smallest) collapse.delete(station.name);
  }

  return collapse;
}
