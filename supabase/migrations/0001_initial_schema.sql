-- UNC Dining Tracker — core schema.
--
-- Two halves:
--   * Menu data (dining_halls, recipes, menu_days, meal_periods, menu_items) is
--     public-read and written only by the scraper via the service-role key.
--   * User data (profiles, food_log) is private to each user, enforced by RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- menu data

create table dining_halls (
  id         bigint generated always as identity primary key,
  slug       text not null unique,          -- URL segment on dining.unc.edu
  name       text not null,
  active     boolean not null default true,
  sort_order int not null default 0
);

-- Primary key is UNC's own recipe id, which we verified is stable across dates.
-- That's what lets us scrape a recipe's nutrition once and cache it forever.
create table recipes (
  id              bigint primary key,
  name            text not null,
  serving_size    text,                     -- display string: "1 each", "½ cup"
  ingredients     text,
  allergens       text[] not null default '{}',
  properties      text[] not null default '{}',
  calories        numeric,
  protein_g       numeric,
  carbs_g         numeric,
  fat_g           numeric,
  sat_fat_g       numeric,
  trans_fat_g     numeric,
  cholesterol_mg  numeric,
  sodium_mg       numeric,
  fiber_g         numeric,
  sugars_g        numeric,
  added_sugar_g   numeric,
  calcium_mg      numeric,
  iron_mg         numeric,
  potassium_mg    numeric,
  vitamin_d_mcg   numeric,
  scraped_at      timestamptz not null default now()
);

create table menu_days (
  id           bigint generated always as identity primary key,
  hall_id      bigint not null references dining_halls(id) on delete cascade,
  service_date date not null,
  scraped_at   timestamptz not null default now(),
  unique (hall_id, service_date)
);

create table meal_periods (
  id          bigint generated always as identity primary key,
  menu_day_id bigint not null references menu_days(id) on delete cascade,
  name        text not null,                -- "Breakfast", "Late Night"
  time_label  text,                         -- "7am-10:45am", as displayed
  start_time  time,
  end_time    time,                         -- may be <= start_time (crosses midnight)
  sort_order  int not null default 0,
  unique (menu_day_id, name)
);

create table menu_items (
  id             bigint generated always as identity primary key,
  meal_period_id bigint not null references meal_periods(id) on delete cascade,
  recipe_id      bigint not null references recipes(id) on delete cascade,
  station        text not null,
  station_order  int not null default 0,
  sort_order     int not null default 0,
  searchable     text
);

create index menu_items_period_idx on menu_items (meal_period_id);
create index menu_items_recipe_idx on menu_items (recipe_id);
create index menu_days_lookup_idx  on menu_days (hall_id, service_date);
create index meal_periods_day_idx  on meal_periods (menu_day_id);
create index recipes_name_idx      on recipes using gin (to_tsvector('english', name));

-- ---------------------------------------------------------------- user data

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  calorie_goal    int    not null default 2000,
  protein_goal_g  int    not null default 150,
  carb_goal_g     int    not null default 250,
  fat_goal_g      int    not null default 65,
  dietary_prefs   text[] not null default '{}',   -- vegan, halal, ...
  allergens_avoid text[] not null default '{}',   -- peanut, milk, ...
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table food_log (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  recipe_id        bigint not null references recipes(id) on delete restrict,
  service_date     date not null,                 -- always the campus (ET) date
  meal_period_name text,
  hall_id          bigint references dining_halls(id) on delete set null,
  servings         numeric not null default 1 check (servings > 0 and servings <= 50),

  -- Per-serving macros are snapshotted at log time. UNC edits recipes, and a
  -- past day's total must not silently change months later.
  calories_snapshot numeric,
  protein_snapshot  numeric,
  carbs_snapshot    numeric,
  fat_snapshot      numeric,

  logged_at        timestamptz not null default now()
);

create index food_log_user_date_idx on food_log (user_id, service_date desc);

create table scraper_runs (
  id             bigint generated always as identity primary key,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  days_scraped   int  not null default 0,
  recipes_added  int  not null default 0,
  ok             boolean not null default false,
  error          text
);

-- ---------------------------------------------------------------------- RLS

alter table dining_halls enable row level security;
alter table recipes      enable row level security;
alter table menu_days    enable row level security;
alter table meal_periods enable row level security;
alter table menu_items   enable row level security;
alter table profiles     enable row level security;
alter table food_log     enable row level security;
alter table scraper_runs enable row level security;

-- Menus are public: browsing the menu never requires an account.
-- No write policies here, so only the service-role key (which bypasses RLS)
-- can write them — that's the scraper.
create policy "menus are public" on dining_halls for select using (true);
create policy "recipes are public" on recipes      for select using (true);
create policy "menu days are public" on menu_days  for select using (true);
create policy "meal periods are public" on meal_periods for select using (true);
create policy "menu items are public" on menu_items for select using (true);

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own food log" on food_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- scraper_runs: no policies at all, so it's service-role only.

-- --------------------------------------------------------------- triggers

-- Every new auth user gets a profile row, so the app never has to cope with
-- a signed-in user who has no settings.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- seed data

insert into dining_halls (slug, name, sort_order) values
  ('chase',         'Chase Dining Hall', 1),
  ('top-of-lenoir', 'Top of Lenoir',     2);
