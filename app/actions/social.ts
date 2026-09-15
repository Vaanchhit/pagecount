"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function findUsers(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq("id", user.id)
    .limit(10);

  return data ?? [];
}

/**
 * Send a friend request.
 *
 * If the other person has already requested you, this accepts theirs instead
 * of creating a second row — otherwise the pair-uniqueness index rejects it
 * and the user sees a confusing error for what is actually a mutual match.
 */
export async function sendRequest(addresseeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (addresseeId === user.id) return { error: "That's you" };

  const { data: existing } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),` +
      `and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return { error: "Already friends" };
    if (existing.addressee_id === user.id) return acceptRequest(existing.id);
    return { error: "Request already sent" };
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: user.id, addressee_id: addresseeId });

  if (error) return { error: "Couldn't send that request" };

  revalidatePath("/friends");
  return { ok: true };
}

export async function acceptRequest(friendshipId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // RLS restricts UPDATE to the addressee, so a requester can't self-accept.
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .eq("addressee_id", user.id);

  if (error) return { error: "Couldn't accept that" };

  revalidatePath("/friends");
  revalidatePath("/feed");
  return { ok: true };
}

export async function removeFriendship(friendshipId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  await supabase.from("friendships").delete().eq("id", friendshipId);

  revalidatePath("/friends");
  revalidatePath("/feed");
  return { ok: true };
}

export async function updateProfile(input: {
  username: string;
  displayName: string;
  timezone: string;
  dailyPageGoal: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Usernames are 3–20 characters: letters, numbers, underscores" };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      username,
      display_name: input.displayName.trim() || username,
      timezone: input.timezone,
      daily_page_goal: Math.max(1, Math.min(2000, input.dailyPageGoal)),
      onboarded: true,
    });

  if (error) {
    return { error: error.code === "23505" ? "That username is taken" : "Couldn't save that" };
  }

  revalidatePath("/library");
  return { ok: true };
}
