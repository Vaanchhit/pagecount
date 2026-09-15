import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BadgeShelf from "@/components/BadgeShelf";
import type { Badge } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: catalogue }, { data: earned }] = await Promise.all([
    supabase.from("badges").select("*").order("tier"),
    supabase.from("user_badges").select("badge_key, earned_at").eq("user_id", user.id),
  ]);

  return (
    <div className="shell__main">
      <section>
        <div className="between mb-md">
          <h1 className="page-title">Badges</h1>
          <span className="badge num">{earned?.length ?? 0} of {catalogue?.length ?? 0}</span>
        </div>
        <BadgeShelf catalogue={(catalogue ?? []) as Badge[]} earned={earned ?? []} />
      </section>
    </div>
  );
}
