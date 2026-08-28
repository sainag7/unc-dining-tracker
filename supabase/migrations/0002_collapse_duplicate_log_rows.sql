-- Collapse duplicate food_log rows into one line per tray slot.
--
-- Quick-add used to INSERT on every tap, so eating fourteen of something wrote
-- fourteen 1x rows instead of moving one row to 14x. `servings numeric` has
-- been on the table since 0001 and the UI has always rendered "14x" correctly —
-- only the write path was wrong. logFood now finds the matching line and
-- increments it; this merges what the old path already left behind and adds the
-- constraint that stops it happening again.
--
-- Idempotent: safe to re-run.

-- 1. Merge existing duplicates.
--
-- Snapshots can differ across a group if UNC revised the recipe between two
-- helpings. The earliest row wins, matching logFood's rule that a day already
-- logged never quietly changes its totals. logged_at comes along with it, so
-- the merged line keeps the time the food was first eaten.
with ranked as (
  select
    id,
    first_value(id) over w as keep_id,
    sum(servings) over (partition by
      user_id, service_date, recipe_id,
      coalesce(meal_period_name, ''), coalesce(hall_id, -1)
    ) as total_servings
  from food_log
  window w as (
    partition by
      user_id, service_date, recipe_id,
      coalesce(meal_period_name, ''), coalesce(hall_id, -1)
    order by logged_at, id
  )
)
update food_log f
set servings = r.total_servings
from ranked r
where f.id = r.keep_id
  and r.id = r.keep_id
  and f.servings <> r.total_servings;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by
        user_id, service_date, recipe_id,
        coalesce(meal_period_name, ''), coalesce(hall_id, -1)
      order by logged_at, id
    ) as keep_id
  from food_log
)
delete from food_log f
using ranked r
where f.id = r.id
  and r.id <> r.keep_id;

-- 2. Keep it collapsed.
--
-- meal_period_name and hall_id are both nullable, and Postgres treats every
-- NULL as distinct, so a plain unique constraint over these columns would let
-- unlimited duplicates through the moment either one is null. Indexing the
-- coalesced expressions is what actually makes the key unique.
create unique index if not exists food_log_slot_idx
  on food_log (
    user_id,
    service_date,
    recipe_id,
    coalesce(meal_period_name, ''),
    coalesce(hall_id, -1)
  );

comment on index food_log_slot_idx is
  'One line per tray slot. logFood increments the matching row rather than inserting.';
