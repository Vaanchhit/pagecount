import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import BookCard from "@/components/BookCard";
import BookSearch from "@/components/BookSearch";
import type { ActivityDay, Badge, LeaderRow, Profile, ShelfBook, Stats, Streak } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // One round trip for everything the page needs.
  const [
    { data: profile },
    { data: streakRows },
    { data: statsRows },
    { data: activity },
    { data: shelf },
    { data: catalogue },
    { data: earned },
    { data: leaderboard },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.rpc("get_streak", { uid: user.id }),
    supabase.rpc("get_stats", { uid: user.id }),
    supabase.rpc("get_activity", { uid: user.id, days_back: 365 }),
    supabase
      .from("user_books")
      .select("id, status, finished_at, books(id, title, author, cover_url, total_pages)")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("started_at", { ascending: false }),
    supabase.from("badges").select("*").order("tier"),
    supabase.from("user_badges").select("badge_key, earned_at").eq("user_id", user.id),
    supabase.rpc("weekly_leaderboard", { uid: user.id }),
  ]);

  const streak = (streakRows?.[0] ?? {
    current_streak: 0, longest_streak: 0, last_active: null, total_days: 0,
  }) as Streak;

  const stats = (statsRows?.[0] ?? {
    total_pages: 0, books_finished: 0, books_reading: 0, pages_today: 0,
  }) as Stats;

  const books = (shelf ?? []) as unknown as ShelfBook[];
  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");
  const wantTo = books.filter((b) => b.status === "want_to_read");

  // Progress per book. Cheap at shelf-sized N; batch into one RPC if a
  // shelf ever runs to hundreds of books.
  const progress = Object.fromEntries(
    await Promise.all(
      reading.map(async (b) => {
        const { data } = await supabase.rpc("get_book_progress", { ub_id: b.id });
        return [b.id, data?.[0] ?? null] as const;
      })
    )
  );

  return (
    <>
      <div className="shell__main">
        <section>
          <h1 className="page-title mb-md">Add a book</h1>
          <BookSearch />
        </section>

        <section>
          <div className="between mb-md">
            <h2 className="page-title">Reading</h2>
            {reading.length > 0 && <span className="badge num">{reading.length}</span>}
          </div>
          {reading.length === 0 ? (
            <p className="meta">Search above to put something on your shelf. One page starts a streak.</p>
          ) : (
            <div className="grid cols-2 sketch-set">
              {reading.map((b) => (
                <BookCard key={b.id} book={b} progress={progress[b.id] ?? undefined} />
              ))}
            </div>
          )}
        </section>

        {wantTo.length > 0 && (
          <section>
            <h2 className="page-title mb-md">Up next</h2>
            <div className="grid cols-2 sketch-set">
              {wantTo.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </section>
        )}

        {finished.length > 0 && (
          <section>
            <div className="between mb-md">
              <h2 className="page-title">Finished</h2>
              <span className="badge num">{finished.length}</span>
            </div>
            <div className="grid cols-2 sketch-set">
              {finished.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </section>
        )}
      </div>

      <Sidebar
        profile={profile as Profile}
        streak={streak}
        stats={stats}
        activity={(activity ?? []) as ActivityDay[]}
        catalogue={(catalogue ?? []) as Badge[]}
        earned={earned ?? []}
        leaderboard={(leaderboard ?? []) as LeaderRow[]}
      />
    </>
  );
}
