/**
 * Runs a full scrape + database sync from the command line.
 *
 *   npx tsx scripts/sync.ts              # today + 7 days
 *   npx tsx scripts/sync.ts 2026-08-20 3 # 3 days from a given start
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from 'dotenv';
import { createAdminClient } from '../src/lib/supabase/admin';
import { runSync } from '../src/lib/scraper/sync';

config({ path: '.env.local' });

async function main() {
  const startDate = process.argv[2];
  const days = process.argv[3] ? Number(process.argv[3]) : undefined;

  console.log(`Syncing${startDate ? ` from ${startDate}` : ''}${days ? ` for ${days} day(s)` : ''}...`);
  const started = Date.now();

  const result = await runSync(createAdminClient(), { startDate, days });
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nDone in ${secs}s`);
  console.log(`  menu days written: ${result.daysScraped}`);
  console.log(`  new recipes cached: ${result.recipesAdded}`);

  if (result.errors.length) {
    console.log(`\n  ${result.errors.length} error(s):`);
    for (const e of result.errors) console.log(`    - ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
