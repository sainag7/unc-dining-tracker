import { parseMenuPage } from './parse-menu';
import { parseRecipe } from './parse-recipe';
import type { ScrapedMenuDay, ScrapedRecipe } from './types';

const BASE = 'https://dining.unc.edu';

/**
 * Identifies the scraper and gives UNC a way to reach us. Set SCRAPER_CONTACT
 * to a real address in production — an anonymous scraper is a rude scraper.
 */
const USER_AGENT = `UNCDiningTracker/1.0 (+student nutrition tracker; contact: ${
  process.env.SCRAPER_CONTACT ?? 'unset'
})`;

/** Minimum gap between outbound requests. Sequential and unhurried by design. */
const REQUEST_INTERVAL_MS = 1000;

let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serializes all outbound requests and keeps them at least one second apart. */
async function throttle(): Promise<void> {
  const wait = lastRequestAt + REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function fetchText(url: string, attempts = 3): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      // Exponential backoff: 2s, 4s. Don't sleep after the final attempt.
      if (attempt < attempts) await sleep(2000 * 2 ** (attempt - 1));
    }
  }

  throw new Error(`Failed after ${attempts} attempts: ${url}`, { cause: lastError });
}

export function menuUrl(hallSlug: string, serviceDate: string): string {
  return `${BASE}/locations/${hallSlug}/?date=${serviceDate}`;
}

export function recipeUrl(recipeId: number): string {
  return `${BASE}/wp-content/themes/nmc_dining/ajax-content/recipe.php?recipe=${recipeId}&hide_allergens=0`;
}

export async function fetchMenuDay(
  hallSlug: string,
  serviceDate: string,
): Promise<ScrapedMenuDay> {
  const html = await fetchText(menuUrl(hallSlug, serviceDate));
  return parseMenuPage(html, hallSlug, serviceDate);
}

export async function fetchRecipe(recipeId: number): Promise<ScrapedRecipe> {
  const body = await fetchText(recipeUrl(recipeId));

  let payload: { html?: string };
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`Recipe ${recipeId}: response was not JSON`);
  }

  if (!payload.html) throw new Error(`Recipe ${recipeId}: response had no html field`);

  return parseRecipe(payload.html, recipeId);
}

/** Every distinct recipe id appearing anywhere in a day's menu. */
export function collectRecipeIds(day: ScrapedMenuDay): Set<number> {
  const ids = new Set<number>();
  for (const period of day.mealPeriods) {
    for (const station of period.stations) {
      for (const item of station.items) ids.add(item.recipeId);
    }
  }
  return ids;
}
