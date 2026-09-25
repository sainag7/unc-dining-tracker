'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Deletes the signed-in account and its whole food log, for good.
 *
 * `delete_my_account` (migration 0003) removes the auth user; profiles and
 * food_log cascade from it. The session's tokens are dead after that, so the
 * sign-out is only there to clear the cookies.
 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { ok: false, error: `Could not delete your account: ${error.message}` };

  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
