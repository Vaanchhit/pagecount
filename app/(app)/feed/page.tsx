import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cover } from "@/components/BookCard";
import { relativeTime, type FeedEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const initials = (s: string) => s.trim().slice(0, 2).toUpperCase();

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.rpc("get_feed", { uid: user.id, lim: 60 });
  const feed = (data ?? []) as FeedEntry[];

  return (
    <div className="shell__main" style={{ maxWidth: 640 }}>
      <section>
        <h1 className="page-title mb-md">What everyone&apos;s reading</h1>

        {feed.length === 0 ? (
          <p className="meta">
            Nothing here yet. <Link href="/friends">Find your friends</Link>, or log some pages
            and your own reading shows up.
          </p>
        ) : (
          <ul className="feed sketch-set">
            {feed.map((e) => {
              const who = e.user_id === user.id ? "You" : e.display_name || e.username;
              return (
                <li key={e.log_id} className="card" style={{ padding: 16 }}>
                  <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <Cover url={e.cover_url} title={e.book_title} w={44} h={66} />

                    <div className="grow">
                      <p className="small">
                        <Link href={`/u/${e.username}`} style={{ color: "var(--text)", fontWeight: 700 }}>
                          {who}
                        </Link>{" "}
                        <span className="muted">
                          {e.finished
                            ? "finished"
                            : `read ${e.pages_read} ${e.pages_read === 1 ? "page" : "pages"} of`}
                        </span>
                      </p>

                      <p className="book-title clamp-2 mt-sm">{e.book_title}</p>
                      {e.book_author && <p className="meta truncate">{e.book_author}</p>}

                      {e.note && <p className="feed__note">{e.note}</p>}

                      <p className="meta num mt-sm">
                        {relativeTime(e.logged_at)}
                        {e.end_page && e.total_pages ? ` · page ${e.end_page} of ${e.total_pages}` : ""}
                      </p>
                    </div>

                    <span className="avatar">{initials(who)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
