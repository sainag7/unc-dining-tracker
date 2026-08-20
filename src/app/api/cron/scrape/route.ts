import { NextResponse } from 'next/server';
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
