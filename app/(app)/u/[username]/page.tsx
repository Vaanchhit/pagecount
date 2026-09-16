import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StreakGrid from "@/components/StreakGrid";
import BadgeShelf from "@/components/BadgeShelf";
import { Cover } from "@/components/BookCard";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import { signOut } from "@/app/actions/account";
import type { ActivityDay, Badge, ShelfBook, Stats, Streak } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("id, username, display_name, avatar_url")
    .eq("username", username).single();

  if (!profile) notFound();
  const isMe = profile.id === user.id;

  // RLS decides visibility. A stranger's shelf comes back empty rather than
  // erroring, so the page renders either way.
  const [
    { data: streakRows }, { data: statsRows }, { data: activity },
    { data: shelf }, { data: catalogue }, { data: earned },
  ] = await Promise.all([
    supabase.rpc("get_streak", { uid: profile.id }),
    supabase.rpc("get_stats", { uid: profile.id }),
    supabase.rpc("get_activity", { uid: profile.id, days_back: 365 }),
    supabase
      .from("user_books")
      .select("id, status, finished_at, books(id, title, author, cover_url, total_pages)")
      .eq("user_id", profile.id).eq("archived", false)
      .order("started_at", { ascending: false }).limit(24),
    supabase.from("badges").select("*").order("tier"),
    supabase.from("user_badges").select("badge_key, earned_at").eq("user_id", profile.id),
  ]);

  const streak = (streakRows?.[0] ?? { current_streak: 0, longest_streak: 0, last_active: null, total_days: 0 }) as Streak;
  const stats = (statsRows?.[0] ?? { total_pages: 0, books_finished: 0, books_reading: 0, pages_today: 0 }) as Stats;
  const books = (shelf ?? []) as unknown as ShelfBook[];
  const name = profile.display_name || profile.username;

  return (
    <div className="shell__main">
      <header className="row" style={{ flexWrap: "nowrap" }}>
        <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
          {name.slice(0, 2).toUpperCase()}
        </span>
        <div className="grow">
          <h1 className="page-title">{name}</h1>
          <p className="meta">@{profile.username}</p>
        </div>
        {isMe && (
          <form action={signOut}>
            <button type="submit" className="btn btn--quiet">Log out</button>
          </form>
        )}
      </header>

      {books.length === 0 && !isMe ? (
        <p className="meta">You&apos;ll see their shelf and streak once you&apos;re friends.</p>
      ) : (
        <>
          <section className="grid cols-4 sketch-set">
            {([
              ["Streak", streak.current_streak],
              ["Best streak", streak.longest_streak],
              ["Pages", stats.total_pages],
              ["Finished", stats.books_finished],
            ] as const).map(([label, value]) => (
              <div key={label} className="card" style={{ padding: 18 }}>
                <div className="stat__value" style={{ marginTop: 0 }}>{value}</div>
                <div className="stat__label">{label}</div>
              </div>
            ))}
          </section>

          <section className="card">
            <StreakGrid activity={(activity ?? []) as ActivityDay[]} />
          </section>

          {books.length > 0 && (
            <section>
              <h2 className="page-title mb-md" style={{ fontSize: 16 }}>On the shelf</h2>
              <div className="row" style={{ gap: 12 }}>
                {books.map((b) => (
                  <Cover key={b.id} url={b.books.cover_url} title={b.books.title} w={64} h={96} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="page-title mb-md" style={{ fontSize: 16 }}>Badges</h2>
            <BadgeShelf catalogue={(catalogue ?? []) as Badge[]} earned={earned ?? []} />
          </section>

          {isMe && (
            <section>
              <h2 className="page-title mb-md" style={{ fontSize: 16 }}>Account</h2>
              <DeleteAccountButton />
            </section>
          )}
        </>
      )}
    </div>
  );
}
