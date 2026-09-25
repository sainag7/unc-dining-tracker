-- Tray writes, as database functions.
--
-- These lived in Next server actions (src/app/actions.ts), which only the web
-- app can call. The iOS app talks to Supabase directly, so the rules — snapshot
-- macros at log time, one line per slot, a 1× line is deleted rather than
-- decremented to zero — move here, where both clients share one copy of them.
--
-- The logging functions are security invoker: they run as the caller, so the
-- "own food log" policy still applies and auth.uid() is the only user id they
-- ever write. delete_my_account is the one exception, below.

-- ------------------------------------------------------------------ log_food

-- Records that the caller ate something, or adds to the line already there.
--
-- The upsert's conflict target has to be the exact expressions in
-- food_log_slot_idx (migration 0002), or Postgres can't infer the index. Doing
-- it in one statement also closes the read-then-write race the server action
-- had: two fast taps now always add up to two.
--
-- A second helping keeps the first helping's snapshot. A day already logged
-- never quietly changes its totals, and UNC can revise a recipe in between.
create or replace function public.log_food(
  p_recipe_id        bigint,
  p_servings         numeric,
  p_service_date     date,
  p_meal_period_name text default null,
  p_hall_id          bigint default null
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   bigint;
begin
  if v_user is null then
    raise exception 'Sign in to keep track of what you eat.' using errcode = '28000';
  end if;
  if p_servings is null or p_servings <= 0 or p_servings > 50 then
    raise exception 'Servings must be between 0 and 50.' using errcode = '22023';
  end if;

  insert into food_log (
    user_id, recipe_id, service_date, meal_period_name, hall_id, servings,
    calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot
  )
  select
    v_user, r.id, p_service_date, p_meal_period_name, p_hall_id, p_servings,
    r.calories, r.protein_g, r.carbs_g, r.fat_g
  from recipes r
  where r.id = p_recipe_id
  on conflict (
    user_id, service_date, recipe_id,
    coalesce(meal_period_name, ''), coalesce(hall_id, -1)
  )
  do update set servings = food_log.servings + excluded.servings
  returning id into v_id;

  if v_id is null then
    raise exception 'That item isn''t on the menu any more.' using errcode = 'P0002';
  end if;

  return v_id;
end;
$$;

-- ------------------------------------------------------------ remove_serving

-- Takes one serving back off a slot. Returns how much came off: 1, or the
-- whole line when it was at or below a single serving — the servings > 0 check
-- means a 1× line can't be updated to zero, so it's deleted instead. Mirrors
-- servingsAfterRemoval in src/lib/log.ts.
--
-- Returns null when there was nothing in the slot.
create or replace function public.remove_serving(
  p_recipe_id        bigint,
  p_service_date     date,
  p_meal_period_name text default null,
  p_hall_id          bigint default null
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_id       bigint;
  v_servings numeric;
begin
  if v_user is null then
    raise exception 'Sign in to keep track of what you eat.' using errcode = '28000';
  end if;

  -- for update: a second concurrent tap waits here instead of reading the same
  -- servings and collapsing two removals into one.
  select id, servings into v_id, v_servings
  from food_log
  where user_id = v_user
    and recipe_id = p_recipe_id
    and service_date = p_service_date
    and coalesce(meal_period_name, '') = coalesce(p_meal_period_name, '')
    and coalesce(hall_id, -1) = coalesce(p_hall_id, -1)
  for update;

  if v_id is null then
    return null;
  end if;

  if v_servings > 1 then
    update food_log set servings = v_servings - 1 where id = v_id;
    return 1;
  end if;

  delete from food_log where id = v_id;
  return v_servings;
end;
$$;

-- --------------------------------------------------------------- restore_log

-- Puts a deleted line back exactly as it was, for undo.
--
-- Not log_food: that takes a fresh snapshot from the recipe, so undoing a
-- delete could change the day's totals if UNC revised the recipe in between.
-- If the slot was re-logged before the undo, the servings go back onto that
-- line rather than tripping the unique index.
create or replace function public.restore_log(
  p_recipe_id         bigint,
  p_service_date      date,
  p_meal_period_name  text,
  p_hall_id           bigint,
  p_servings          numeric,
  p_calories_snapshot numeric,
  p_protein_snapshot  numeric,
  p_carbs_snapshot    numeric,
  p_fat_snapshot      numeric
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   bigint;
begin
  if v_user is null then
    raise exception 'Sign in to keep track of what you eat.' using errcode = '28000';
  end if;
  if p_servings is null or p_servings <= 0 or p_servings > 50 then
    raise exception 'Servings must be between 0 and 50.' using errcode = '22023';
  end if;

  insert into food_log (
    user_id, recipe_id, service_date, meal_period_name, hall_id, servings,
    calories_snapshot, protein_snapshot, carbs_snapshot, fat_snapshot
  )
  values (
    v_user, p_recipe_id, p_service_date, p_meal_period_name, p_hall_id, p_servings,
    p_calories_snapshot, p_protein_snapshot, p_carbs_snapshot, p_fat_snapshot
  )
  on conflict (
    user_id, service_date, recipe_id,
    coalesce(meal_period_name, ''), coalesce(hall_id, -1)
  )
  do update set servings = least(food_log.servings + excluded.servings, 50)
  returning id into v_id;

  return v_id;
end;
$$;

-- -------------------------------------------------------- delete_my_account

-- Deletes the caller's account and everything hanging off it. The App Store
-- requires this to be possible from inside the app (guideline 5.1.1(v)).
--
-- security definer because only the owner of auth.users can delete from it.
-- It takes no arguments and only ever touches auth.uid(), so there is no way
-- to aim it at someone else. profiles and food_log cascade from auth.users.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  delete from auth.users where id = v_user;
end;
$$;

-- ------------------------------------------------------------------ grants

-- Functions are executable by PUBLIC by default. Only signed-in users should
-- reach any of these; anon would fail the auth.uid() check anyway, but a
-- permission error is clearer than a function body running at all.
revoke all on function public.log_food(bigint, numeric, date, text, bigint) from public, anon;
revoke all on function public.remove_serving(bigint, date, text, bigint) from public, anon;
revoke all on function public.restore_log(bigint, date, text, bigint, numeric, numeric, numeric, numeric, numeric) from public, anon;
revoke all on function public.delete_my_account() from public, anon;

grant execute on function public.log_food(bigint, numeric, date, text, bigint) to authenticated;
grant execute on function public.remove_serving(bigint, date, text, bigint) to authenticated;
grant execute on function public.restore_log(bigint, date, text, bigint, numeric, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
