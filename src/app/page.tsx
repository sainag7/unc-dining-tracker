import { createClient } from '@/lib/supabase/server';
import { getHalls, getMealPeriods, getStations } from '@/lib/menu';
import { getProfile, getLoggedServingsByRecipe, getUsualRecipeIds } from '@/lib/log';
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

  const requested = param('period');
  const period =
    periods.find((p) => p.name === requested) ??
    periods[date === today ? currentMealPeriodIndex(periods) : 0] ??
    null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [stations, profile, loggedMap] = await Promise.all([
    period ? getStations(supabase, period.id) : Promise.resolve([]),
    user ? getProfile(supabase, user.id) : Promise.resolve(null),
    user
      ? getLoggedServingsByRecipe(supabase, user.id, date)
      : Promise.resolve(new Map<number, number>()),
  ]);

  // Usuals need the menu first, since they're only worth showing for food
  // that's actually being served right now.
  const onMenu = new Set(stations.flatMap((s) => s.items.map((i) => i.id)));
  const usualIds =
    user && hall && period
      ? await getUsualRecipeIds(supabase, user.id, hall.id, period.name, onMenu)
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
          <div className="px-6 py-20 text-center">
            <p className="signage text-xl">No menu posted</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
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
