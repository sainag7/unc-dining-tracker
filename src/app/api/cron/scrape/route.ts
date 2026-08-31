import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSync } from '@/lib/scraper/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Nightly scrape, triggered by Vercel Cron (see vercel.json).
 *
 * Guarded by CRON_SECRET: Vercel sends it as a bearer token, and it doubles as
 * the way to trigger a run by hand during development.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSync(createAdminClient());

    // The menu readers are cached with an hour's TTL (lib/menu.ts). Without
    // this a fresh scrape would sit invisible behind a stale entry for up to
    // that long; with it, the new menu is live the moment the scrape finishes.
    //
    // Next 16 requires a cache profile here. 'max' is stale-while-revalidate:
    // the next visitor is served the old menu instantly while the new one
    // loads behind them, rather than being made to wait for the refetch.
    revalidateTag('menu', 'max');

    return NextResponse.json({
      ok: result.errors.length === 0,
      daysScraped: result.daysScraped,
      recipesAdded: result.recipesAdded,
      errors: result.errors,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
