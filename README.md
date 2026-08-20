# Tray

Track what you eat at UNC's dining halls.

Chase and Lenoir publish full nutrition data for every item they serve, but there's no way
to keep a running count of what you actually ate. Tray scrapes those menus into its own
database, shows you what's being served right now, and lets you tap the things you ate to
build a daily calorie and macro total.

- **Menus are public.** Browsing works without an account; you only sign in to log food.
- **Portions are multipliers.** "Two waffles" and "half a serving" are first-class, because
  a tracker that assumes one serving isn't telling you the truth.
- **Allergens are flagged, never hidden.** Silently removing items looks identical to
  having no data on them, which is the more dangerous failure.

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Auth) · Tailwind v4 · Vercel Cron

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project's values
npm run dev
```

### Database

Migrations live in `supabase/migrations/`. Against a hosted project, run them from the
Supabase SQL editor or with `npx supabase db push`. For local development:

```bash
npx supabase start             # needs Docker running
npx supabase db reset          # applies migrations + seeds the two halls
```

`npx supabase start` prints local URLs and keys to put in `.env.local`.

### Loading menu data

```bash
npx tsx scripts/sync.ts               # today + 7 days, both halls
npx tsx scripts/sync.ts 2026-08-20 3  # 3 days from a given date
```

The first run is slow — it fetches nutrition for every recipe it has never seen, at one
request per second. After that the cache is warm and daily runs fetch only the handful of
new recipes, so they finish in well under a minute.

To check the scraper still matches the live site without touching the database:

```bash
npx tsx scripts/verify-scrape.ts
```

### Auth setup

In your Supabase project:

1. **Authentication → Providers → Google**: enable it, add your OAuth client ID/secret from
   Google Cloud Console, and set the authorized redirect URI to
   `https://<project>.supabase.co/auth/v1/callback`.
2. **Authentication → URL Configuration**: add `http://localhost:3000/auth/callback` and
   your production callback URL to the allow list.
3. **Authentication → Email Templates → Confirm signup**: make sure the template includes
   `{{ .Token }}`. The login flow uses a 6-digit code, not a magic link.

## How the scraper works

Menu pages are server-rendered, so no headless browser is involved.

```
https://dining.unc.edu/locations/chase/?date=YYYY-MM-DD
```

Each item carries a `data-recipe` id, and nutrition comes from the endpoint behind the
site's own nutrition popup:

```
/wp-content/themes/nmc_dining/ajax-content/recipe.php?recipe=<id>
```

Recipe ids are **stable across dates** — measured at ~77% day-to-day overlap on Chase —
which is what makes caching viable. `syncAll` fetches menus first, then looks up only the
recipe ids it has never seen before.

Both parsers throw rather than return empty results. A site redesign should fail loudly and
leave yesterday's cached menu intact, because "the dining hall is serving nothing today" is
never the right conclusion to write to the database.

Fetching is sequential and rate-limited to one request per second, with a `User-Agent` that
names the app and a contact address from `SCRAPER_CONTACT`.

### Scheduling

`vercel.json` runs `/api/cron/scrape` daily at 08:00 UTC — 4am ET in summer, 3am in winter.
The route requires `Authorization: Bearer $CRON_SECRET`, which Vercel sends automatically
and which also lets you trigger a run by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/scrape
```

## Tests

```bash
npm test
```

Parser tests run against saved HTML fixtures in `src/lib/scraper/__fixtures__/`, so they
don't hit the network. They cover the awkward real-world cases: meal periods that cross
midnight, `&frac12;` in serving sizes, and nested nutrition rows where "Added Sugar" must
not be swallowed by "Sugars".

## Notes

- All dates resolve in `America/New_York`. An 8pm dinner has to land on today's log, not
  tomorrow's.
- `food_log` snapshots each item's per-serving macros at log time. UNC revises recipes, and
  a day you already logged should never quietly change its totals afterwards.
- Row Level Security is on for every table. Menu data is public-read and writable only by
  the service-role key; `profiles` and `food_log` are scoped to their owner.
