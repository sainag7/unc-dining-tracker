import type { StationWithItems } from './menu';

/**
 * Stations that serve an actual plate of food, in the order they should appear.
 *
 * UNC's own menu order buries these — a Chase dinner opens on Waffle Bar and
 * Ice Cream, while Simply Prepared sits fourteen stations down. These are what
 * people go to the hall for, so they lead.
 *
 * Matching is by substring, so "simply prepared" covers both Simply Prepared
 * and Simply Prepared Griddle, and "plant forward" covers the Vegan variant.
 */
const MAIN_COURSE_STATIONS = [
  'simply prepared',
  'made-to-order',
  'the grill',
  'the griddle',
  'the kitchen table',
  'build your own',
  'burritos',
  'international flavors',
  'pizza',
  'pasta',
  'sushi',
  'plant forward',
];

/**
 * Self-serve component bars, as opposed to stations that serve dishes.
 *
 * Measured across every station name in the database: Salad Bar averages 41
 * items, Deli 35, Beverages 33. On a Chase dinner these are 165 of the 272
 * items — they belong at the bottom, closed.
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

/** No station of actual dishes runs this long — a safety net for renamed bars. */
const LARGE_STATION = 20;

/** 0 = main course, 1 = sides and sweets, 2 = component bar. */
type Tier = 0 | 1 | 2;

/** Position in MAIN_COURSE_STATIONS, or -1 when it isn't a main course. */
function mainCourseRank(name: string): number {
  const lower = name.toLowerCase();
  return MAIN_COURSE_STATIONS.findIndex((pattern) => lower.includes(pattern));
}

/**
 * Main course wins over every other signal: a popular station stays up top and
 * open even if it happens to list a lot of items.
 */
function tierOf(station: StationWithItems): Tier {
  if (mainCourseRank(station.name) !== -1) return 0;

  const lower = station.name.toLowerCase();
  const isComponent =
    COMPONENT_STATIONS.some((pattern) => lower.includes(pattern)) ||
    station.items.length > LARGE_STATION;

  return isComponent ? 2 : 1;
}

/**
 * Sorts a menu so main courses lead and component bars sink.
 *
 * Within a tier the original menu order is kept, so Simply Prepared still comes
 * before Simply Prepared Griddle and UNC's own sequencing survives everywhere
 * we haven't deliberately overridden it.
 */
export function orderStations(stations: StationWithItems[]): StationWithItems[] {
  return stations
    .map((station, menuOrder) => ({ station, menuOrder }))
    .sort((a, b) => {
      const tierA = tierOf(a.station);
      const tierB = tierOf(b.station);
      if (tierA !== tierB) return tierA - tierB;

      if (tierA === 0) {
        const rankA = mainCourseRank(a.station.name);
        const rankB = mainCourseRank(b.station.name);
        if (rankA !== rankB) return rankA - rankB;
      }

      return a.menuOrder - b.menuOrder;
    })
    .map(({ station }) => station);
}

/**
 * Decides which stations open collapsed so the menu leads with food.
 *
 * Collapsing is never destructive: a collapsed station still renders as a
 * header row with its name and item count, so it reads as an index entry
 * rather than something hidden. A wrong guess costs the user one tap.
 */
export function stationsToCollapse(stations: StationWithItems[]): Set<string> {
  const collapse = new Set(
    stations.filter((station) => tierOf(station) === 2).map((station) => station.name),
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
