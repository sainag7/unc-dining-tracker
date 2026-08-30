/**
 * A read the page is allowed to lose.
 *
 * Personalization — the tray, today's counts — is an enhancement on top
 * of the menu. The menu is the product, and it works signed out, so nothing
 * about a user's own data failing to load should be able to take it down.
 *
 * That was not theoretical: `getDayLog` throws on any Postgres error and is
 * called from the root layout, where no `error.tsx` can catch it. One rejected
 * token 500'd every route in the app, including the pages that need no auth.
 */

export interface Tolerated<T> {
  data: T;
  /** True when every attempt failed and `data` is the fallback. */
  failed: boolean;
}

/**
 * Supabase mints access tokens on one node and validates them on another, with
 * no clock leeway on the `iat` claim. A second of drift between the two is
 * enough for PostgREST to reject a token it issued moments earlier, and it
 * resolves itself as the clocks converge. Those are worth one more try; a
 * genuine fault — bad SQL, network down — is not, so the match stays narrow
 * rather than doubling the render time of every real failure.
 */
function isTransient(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /jwt|token|PGRST301|issued at future/i.test(message);
}

const RETRY_DELAY_MS = 750;

export async function tolerate<T>(
  run: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<Tolerated<T>> {
  try {
    return { data: await run(), failed: false };
  } catch (err) {
    if (!isTransient(err)) {
      console.error(`[tolerate] ${label} failed:`, err);
      return { data: fallback, failed: true };
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    try {
      return { data: await run(), failed: false };
    } catch (retryErr) {
      // Logged, never swallowed silently — this is the only record that the
      // page rendered with something missing.
      console.error(`[tolerate] ${label} failed after one retry:`, retryErr);
      return { data: fallback, failed: true };
    }
  }
}
