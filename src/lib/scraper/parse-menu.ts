import * as cheerio from 'cheerio';
import type {
  ScrapedItem,
  ScrapedMealPeriod,
  ScrapedMenuDay,
  ScrapedStation,
} from './types';

/** Thrown when the page loads but doesn't look like a menu any more. */
export class MenuParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MenuParseError';
  }
}

/**
 * Turns a clock string from a tab label into 24h "HH:MM".
 * Handles "7am", "10:45am", "12am" (midnight), "12pm" (noon), "8:30pm".
 * Returns null for anything that doesn't match, so an odd label degrades to
 * a display-only string rather than blowing up the whole scrape.
 */
export function parseClock(raw: string): string | null {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3];

  if (hour < 1 || hour > 12 || minute > 59) return null;

  // 12am is midnight (00), 12pm is noon (12); everything else shifts by 12 for pm.
  if (meridiem === 'am') hour = hour === 12 ? 0 : hour;
  else hour = hour === 12 ? 12 : hour + 12;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Splits a tab label like "Late Lunch (3pm-5pm)" into its name and times.
 * The site uses inconsistent spacing ("Late Night  (9pm-12am)"), and en-dashes
 * turn up occasionally, so both are normalized here.
 */
export function parseMealPeriodLabel(label: string): {
  name: string;
  timeLabel: string | null;
  startTime: string | null;
  endTime: string | null;
} {
  const clean = label.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.*?)\s*\(([^)]*)\)\s*$/);

  if (!m) {
    return { name: clean, timeLabel: null, startTime: null, endTime: null };
  }

  const name = m[1].trim();
  const timeLabel = m[2].trim();
  const parts = timeLabel.split(/\s*[-–—]\s*/);

  if (parts.length !== 2) {
    return { name, timeLabel, startTime: null, endTime: null };
  }

  return {
    name,
    timeLabel,
    startTime: parseClock(parts[0]),
    endTime: parseClock(parts[1]),
  };
}

/** Pulls `allergen-has_x` / `prop-y` keys off an anchor's class list. */
function parseTags(classAttr: string): { allergens: string[]; properties: string[] } {
  const allergens: string[] = [];
  const properties: string[] = [];

  for (const cls of classAttr.split(/\s+/)) {
    if (cls.startsWith('allergen-has_')) allergens.push(cls.slice('allergen-has_'.length));
    else if (cls.startsWith('prop-')) properties.push(cls.slice('prop-'.length));
  }

  return { allergens, properties };
}

/**
 * Parses a UNC dining location page into its meal periods, stations, and items.
 *
 * Throws MenuParseError if the page yields no items at all. That's deliberate:
 * a silent empty result would overwrite a good cached menu with nothing, and
 * "the dining hall is serving no food today" is never the right conclusion.
 */
export function parseMenuPage(
  html: string,
  hallSlug: string,
  serviceDate: string,
): ScrapedMenuDay {
  const $ = cheerio.load(html);

  // Tab buttons carry the meal period names/times; their aria-controls points at
  // the panel holding that period's stations.
  const labels = new Map<string, string>();
  $('button[role="tab"][aria-controls]').each((_, el) => {
    const panelId = $(el).attr('aria-controls');
    const text = $(el).find('.c-tabs-nav__link-inner').text();
    if (panelId && text.trim()) labels.set(panelId, text);
  });

  if (labels.size === 0) {
    throw new MenuParseError(
      `No meal period tabs found for ${hallSlug} on ${serviceDate} — page structure may have changed`,
    );
  }

  const mealPeriods: ScrapedMealPeriod[] = [];
  let sortOrder = 0;
  let totalItems = 0;

  for (const [panelId, rawLabel] of labels) {
    const panel = $(`#${panelId}`);
    if (panel.length === 0) continue;

    const stations: ScrapedStation[] = [];

    panel.find('.menu-station').each((_, stationEl) => {
      const $station = $(stationEl);
      const name = $station.find('button.toggle-menu-station-data').first().text().trim();
      const description =
        $station.find('.menu-station-description').first().text().trim() || null;

      const items: ScrapedItem[] = [];

      $station.find('li.menu-item-li').each((_, itemEl) => {
        const $item = $(itemEl);
        const $anchor = $item.find('a.show-nutrition').first();

        const recipeId = Number($anchor.attr('data-recipe'));
        const itemName = $anchor.text().trim();

        // Items without a resolvable recipe id have no nutrition to attach, so
        // they'd be untrackable. Skip rather than store a broken row.
        if (!Number.isFinite(recipeId) || recipeId <= 0 || !itemName) return;

        const { allergens, properties } = parseTags($anchor.attr('class') ?? '');

        items.push({
          recipeId,
          name: itemName,
          allergens,
          properties,
          searchable: ($item.attr('data-searchable') ?? '').trim(),
        });
      });

      if (items.length > 0) {
        stations.push({ name: name || 'Other', description, items });
        totalItems += items.length;
      }
    });

    const { name, timeLabel, startTime, endTime } = parseMealPeriodLabel(rawLabel);

    mealPeriods.push({ name, timeLabel, startTime, endTime, sortOrder: sortOrder++, stations });
  }

  if (totalItems === 0) {
    throw new MenuParseError(
      `Found ${labels.size} meal periods but zero items for ${hallSlug} on ${serviceDate} — refusing to write an empty menu`,
    );
  }

  return { hallSlug, serviceDate, mealPeriods };
}
