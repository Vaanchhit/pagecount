"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Deletes the auth.users row via the admin API. profiles.id references
 * auth.users on delete cascade, and every other table cascades from there
 * (user_books, reading_logs, friendships, streak_freezes, user_badges) —
 * so this one call is the whole deletion.
 */
export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Couldn't delete your account. Try again in a moment." };

  await supabase.auth.signOut();
  redirect("/login");
}
