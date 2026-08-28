import { createClient } from '@/lib/supabase/server';
import { getHalls, getMealPeriods, getStations } from '@/lib/menu';
import { getProfile, getLoggedServingsByRecipe, getUsualRecipeIds } from '@/lib/log';
import { tolerate } from '@/lib/tolerate';
import { campusToday, currentMealPeriodIndex, servingMealPeriodIndex } from '@/lib/dates';
import { MenuMasthead } from '@/components/menu-masthead';
import { MenuBrowser } from '@/components/menu-browser';

const DEFAULT_HALL = 'chase';

export default async function MenusPage(props: PageProps<'/'>) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const today = campusToday();
  const param = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const date = param('date') ?? today;
  const hallSlug = param('hall') ?? DEFAULT_HALL;

  const [halls, periods] = await Promise.all([
    getHalls(supabase),
    getMealPeriods(supabase, hallSlug, date),
  ]);

  const hall = halls.find((h) => h.slug === hallSlug) ?? halls[0] ?? null;

  // "Serving now" is strict — blank between services. Tab selection is forgiving,
  // falling forward to whatever is most useful to look at.
  const servingNowPeriod =
    date === today ? (periods[servingMealPeriodIndex(periods)]?.name ?? null) : null;

  // On another day there is no "now" to fall forward from, so this used to
  // pick index 0 — every backfilled meal got tagged Breakfast whatever time it
  // was actually eaten, which then mis-sorted the whole day in the log.
  // currentMealPeriodIndex is already forgiving; letting it answer for any date
  // lands on the period matching the time of day instead.
  const requested = param('period');
  const period =
    periods.find((p) => p.name === requested) ?? periods[currentMealPeriodIndex(periods)] ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getStations is the menu itself — if that fails the page has nothing to say,
  // so it still throws up to error.tsx. The two personal reads degrade instead:
  // rows fall back to a plain +, which is exactly the signed-out rendering. No
  // notice here — these use the same token as the layout's tray read, so they
  // fail together and TrayNotice already says so once.
  const [stations, profile, loggedServings] = await Promise.all([
    period ? getStations(supabase, period.id) : Promise.resolve([]),
    user ? getProfile(supabase, user.id) : Promise.resolve(null),
    user
      ? tolerate(
          () =>
            getLoggedServingsByRecipe(
              supabase,
              user.id,
              date,
              period?.name ?? null,
              hall?.id ?? null,
            ),
          new Map<number, number>(),
          "today's logged servings",
        )
      : Promise.resolve({ data: new Map<number, number>(), failed: false }),
  ]);
  const loggedMap = loggedServings.data;

  // Usuals need the menu first, since they're only worth showing for food
  // that's actually being served right now.
  const onMenu = new Set(stations.flatMap((s) => s.items.map((i) => i.id)));
  const usualIds =
    user && hall && period
      ? (
          await tolerate(
            () => getUsualRecipeIds(supabase, user.id, hall.id, period.name, onMenu),
            [] as number[],
            'usuals',
          )
        ).data
      : [];

  return (
    <>
      <MenuMasthead
        halls={halls}
        currentHall={hall?.slug ?? DEFAULT_HALL}
        date={date}
        today={today}
        periods={periods}
        currentPeriod={period?.name ?? null}
        servingNowPeriod={servingNowPeriod}
      />

      <main className="flex-1">
        {periods.length === 0 ? (
          <div className="mx-auto w-full max-w-[640px] px-6 py-20 text-center">
            <p className="text-input font-semibold">No menu posted</p>
            <p className="mx-auto mt-2 max-w-sm text-body text-text-muted">
              UNC hasn&rsquo;t published this day yet, or the hall isn&rsquo;t serving. Menus
              usually appear about a week ahead — try another date.
            </p>
          </div>
        ) : (
          <MenuBrowser
            stations={stations}
            defaultFilters={profile?.dietary_prefs ?? []}
            loggedServings={Object.fromEntries(loggedMap)}
            usualIds={usualIds}
            context={{
              serviceDate: date,
              mealPeriodName: period?.name ?? null,
              hallId: hall?.id ?? null,
              isSignedIn: Boolean(user),
              allergensAvoid: profile?.allergens_avoid ?? [],
            }}
          />
        )}
      </main>
    </>
  );
}
