/**
 * Live smoke test for the scraper. Hits the real UNC site for both halls and
 * prints what it found, so we can eyeball that the parsers still match reality.
 *
 *   npx tsx scripts/verify-scrape.ts [YYYY-MM-DD]
 *
 * This is a diagnostic, not part of the app or the test suite.
 */
import { fetchMenuDay, fetchRecipe, collectRecipeIds } from '../src/lib/scraper/fetch';
import { campusToday } from '../src/lib/dates';

const HALLS = ['chase', 'top-of-lenoir'];
const EXPECTED_PERIODS: Record<string, number> = { chase: 6, 'top-of-lenoir': 4 };

async function main() {
  const date = process.argv[2] ?? campusToday();
  console.log(`\nVerifying scrape for ${date}\n${'='.repeat(60)}`);

  const allIds = new Set<number>();
  let failures = 0;

  for (const hall of HALLS) {
    console.log(`\n${hall}`);
    try {
      const day = await fetchMenuDay(hall, date);
      const ids = collectRecipeIds(day);
      for (const id of ids) allIds.add(id);

      const expected = EXPECTED_PERIODS[hall];
      const got = day.mealPeriods.length;
      const ok = got === expected ? 'ok' : `MISMATCH (expected ${expected})`;
      console.log(`  meal periods: ${got}  [${ok}]`);
      if (got !== expected) failures++;

      for (const p of day.mealPeriods) {
        const items = p.stations.reduce((n, s) => n + s.items.length, 0);
        const time = p.startTime && p.endTime ? `${p.startTime}-${p.endTime}` : '(no time)';
        console.log(
          `    ${p.name.padEnd(13)} ${time.padEnd(13)} ${String(p.stations.length).padStart(2)} stations, ${String(items).padStart(3)} items`,
        );
        if (items === 0) {
          console.log(`      ^ WARNING: no items`);
          failures++;
        }
      }
      console.log(`  distinct recipes: ${ids.size}`);
    } catch (err) {
      console.log(`  FAILED: ${(err as Error).message}`);
      failures++;
    }
  }

  console.log(`\n${'='.repeat(60)}\nSpot-checking nutrition for 5 recipes\n`);

  const sample = [...allIds].slice(0, 5);
  for (const id of sample) {
    try {
      const r = await fetchRecipe(id);
      const missing = r.calories === null || r.proteinG === null;
      console.log(
        `  [${String(id).padStart(6)}] ${r.name.slice(0, 30).padEnd(32)}` +
          `${String(r.calories ?? '--').padStart(5)} cal  ` +
          `P${String(r.proteinG ?? '--').padStart(5)}  ` +
          `C${String(r.carbsG ?? '--').padStart(5)}  ` +
          `F${String(r.fatG ?? '--').padStart(5)}  ` +
          `serving="${r.servingSize}"${missing ? '  <-- MISSING DATA' : ''}`,
      );
      if (missing) failures++;
    } catch (err) {
      console.log(`  [${id}] FAILED: ${(err as Error).message}`);
      failures++;
    }
  }

  console.log(
    `\n${'='.repeat(60)}\n` +
      (failures === 0
        ? 'PASS — scraper matches the live site.\n'
        : `FAIL — ${failures} problem(s) above.\n`),
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
