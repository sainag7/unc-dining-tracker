/**
 * Proves the row-level security policies actually isolate users.
 *
 *   npx tsx scripts/verify-rls.ts
 *
 * Creates two throwaway users, has one log some food, and checks that the other
 * — and an anonymous visitor — cannot see or touch it. Deletes both users at the
 * end. Point it at a local Supabase, never at production data.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';

config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;

function check(passed: boolean, label: string, detail = '') {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures++;
}

async function makeUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Could not create ${email}: ${error?.message}`);

  const client = createClient<Database>(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: 'test-password-123',
  });
  if (signInErr) throw new Error(`Could not sign in ${email}: ${signInErr.message}`);

  return { id: data.user.id, client };
}

async function main() {
  const stamp = Date.now();
  const alice = await makeUser(`rls-alice-${stamp}@example.com`);
  const bob = await makeUser(`rls-bob-${stamp}@example.com`);

  try {
    const { data: recipe } = await admin.from('recipes').select('id').limit(1).maybeSingle();
    if (!recipe) throw new Error('No recipes in the database — run `npm run sync` first.');

    console.log('\nProfile creation');
    const { data: aliceProfile } = await alice.client
      .from('profiles')
      .select('id')
      .eq('id', alice.id)
      .maybeSingle();
    check(aliceProfile?.id === alice.id, 'signing up creates exactly one profile row');

    console.log('\nFood log isolation');
    const { error: insertErr } = await alice.client.from('food_log').insert({
      user_id: alice.id,
      recipe_id: recipe.id,
      service_date: '2026-08-20',
      servings: 1,
      calories_snapshot: 100,
    });
    check(!insertErr, 'a user can log their own food', insertErr?.message);

    const { data: aliceRows } = await alice.client.from('food_log').select('id');
    check(aliceRows?.length === 1, 'the owner sees their own entry');

    const { data: bobRows } = await bob.client.from('food_log').select('id');
    check(bobRows?.length === 0, 'another user sees none of it', `saw ${bobRows?.length}`);

    const entryId = aliceRows?.[0]?.id;
    if (entryId) {
      const { data: updated } = await bob.client
        .from('food_log')
        .update({ servings: 99 })
        .eq('id', entryId)
        .select();
      check(!updated?.length, 'another user cannot change it');

      const { data: deleted } = await bob.client
        .from('food_log')
        .delete()
        .eq('id', entryId)
        .select();
      check(!deleted?.length, 'another user cannot delete it');
    }

    console.log('\nForging a user_id');
    const { error: forgeErr } = await bob.client.from('food_log').insert({
      user_id: alice.id,
      recipe_id: recipe.id,
      service_date: '2026-08-20',
      servings: 1,
    });
    check(Boolean(forgeErr), 'writing a row as someone else is rejected');

    console.log('\nProfile isolation');
    const { data: bobSeesProfiles } = await bob.client.from('profiles').select('id');
    check(
      bobSeesProfiles?.length === 1 && bobSeesProfiles[0].id === bob.id,
      'a user sees only their own profile',
    );

    console.log('\nLogging functions (migration 0003)');
    const slot = {
      p_recipe_id: recipe.id,
      p_service_date: '2026-08-21',
      p_meal_period_name: null,
      p_hall_id: null,
    };
    const { error: logErr } = await bob.client.rpc('log_food', { ...slot, p_servings: 1 });
    check(!logErr, 'log_food writes a line', logErr?.message);
    await bob.client.rpc('log_food', { ...slot, p_servings: 2 });
    const { data: bobLines } = await bob.client
      .from('food_log')
      .select('user_id, servings')
      .eq('service_date', '2026-08-21');
    check(
      bobLines?.length === 1 && bobLines[0].servings === 3,
      'a second log_food on the same slot adds to the line',
      JSON.stringify(bobLines),
    );
    check(bobLines?.[0]?.user_id === bob.id, 'log_food writes as the caller, never anyone else');

    const { data: removed } = await bob.client.rpc('remove_serving', slot);
    check(removed === 1, 'remove_serving takes one serving off', `removed ${removed}`);

    const { data: aliceAfter } = await alice.client
      .from('food_log')
      .select('id')
      .eq('service_date', '2026-08-21');
    check(!aliceAfter?.length, "another user's log_food never lands in your log");

    const { data: aliceRemoved } = await alice.client.rpc('remove_serving', slot);
    check(aliceRemoved === null, "remove_serving can't reach another user's line");

    const { error: anonRpcErr } = await createClient<Database>(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).rpc('log_food', { ...slot, p_servings: 1 });
    check(Boolean(anonRpcErr), 'log_food is refused signed out');

    console.log('\nDeleting an account');
    const carol = await makeUser(`rls-carol-${stamp}@example.com`);
    await carol.client.rpc('log_food', { ...slot, p_servings: 1 });
    const { error: deleteErr } = await carol.client.rpc('delete_my_account');
    check(!deleteErr, 'delete_my_account succeeds', deleteErr?.message);

    const { data: carolUser } = await admin.auth.admin.getUserById(carol.id);
    check(!carolUser?.user, 'the auth user is gone');
    if (carolUser?.user) await admin.auth.admin.deleteUser(carol.id);
    const { count: carolRows } = await admin
      .from('food_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', carol.id);
    check(carolRows === 0, 'their food log went with it', `${carolRows} rows left`);

    const { data: bobStill } = await admin.auth.admin.getUserById(bob.id);
    check(Boolean(bobStill?.user), 'nobody else was deleted');

    console.log('\nAnonymous access');
    const anon = createClient<Database>(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: anonMenu } = await anon.from('menu_items').select('id').limit(1);
    check(Boolean(anonMenu), 'menus are readable signed out');

    const { data: anonHalls } = await anon.from('dining_halls').select('id');
    check((anonHalls?.length ?? 0) > 0, 'dining halls are readable signed out');

    const { data: anonLog } = await anon.from('food_log').select('id');
    check(!anonLog?.length, 'food logs are not readable signed out');

    const { error: anonWriteErr } = await anon
      .from('recipes')
      .insert({ id: 999999999, name: 'Injected' });
    check(Boolean(anonWriteErr), 'menu data is not writable signed out');
  } finally {
    await admin.auth.admin.deleteUser(alice.id);
    await admin.auth.admin.deleteUser(bob.id);
    console.log('\nCleaned up test users.');
  }

  console.log(failures === 0 ? '\nPASS — RLS is holding.\n' : `\nFAIL — ${failures} issue(s).\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
