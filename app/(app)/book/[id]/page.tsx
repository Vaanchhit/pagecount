import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cover } from "@/components/BookCard";
import BookActions from "@/components/BookActions";
import type { BookProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ub } = await supabase
    .from("user_books")
    .select("id, user_id, status, started_at, finished_at, books(id, title, author, cover_url, total_pages)")
    .eq("id", id)
    .single();

  if (!ub) notFound();

  const book = ub.books as unknown as {
    title: string; author: string | null; cover_url: string | null; total_pages: number | null;
  };

  const [{ data: prog }, { data: logs }] = await Promise.all([
    supabase.rpc("get_book_progress", { ub_id: id }),
    supabase
      .from("reading_logs")
      .select("id, pages_read, end_page, note, local_date, logged_at")
      .eq("user_book_id", id)
      .order("logged_at", { ascending: false })
      .limit(60),
  ]);

  const p = (prog?.[0] ?? null) as BookProgress | null;
  const isMine = ub.user_id === user.id;

  return (
    <div className="shell__main" style={{ maxWidth: 680 }}>
      <section>
        <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 20 }}>
          <Cover url={book.cover_url} title={book.title} w={104} h={156} />

          <div className="grow">
            <h1 className="page-title">{book.title}</h1>
            {book.author && <p className="meta mt-sm">{book.author}</p>}

            {p && book.total_pages && (
              <div className="mt-md">
                <span className="progress"><span style={{ width: `${p.percent ?? 0}%` }} /></span>
                <p className="meta num mt-sm">
                  Page {p.current_page ?? 0} of {book.total_pages} · {p.percent ?? 0}%
                </p>
              </div>
            )}

            {isMine && (
              <div className="mt-md">
                <BookActions
                  userBookId={id}
                  title={book.title}
                  totalPages={book.total_pages}
                  currentPage={p?.current_page ?? null}
                  status={ub.status}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {p && p.active_days > 0 && (
        <section className="grid cols-4 sketch-set">
          {([
            ["Pages read", p.pages_total],
            ["Days on it", p.active_days],
            ["Per day", p.pages_per_day ?? "—"],
            ["Days left", p.days_remaining ?? "—"],
          ] as const).map(([label, value]) => (
            <div key={label} className="card" style={{ padding: 18 }}>
              <div className="stat__value" style={{ marginTop: 0 }}>{value}</div>
              <div className="stat__label">{label}</div>
            </div>
          ))}
        </section>
      )}

      {p?.days_remaining ? (
        <section>
          <p className="card" style={{ background: "var(--chalk)", padding: 18 }}>
            At <span className="num">{p.pages_per_day}</span> pages a day, you&apos;ll finish in about{" "}
            <span className="num">{p.days_remaining}</span> {p.days_remaining === 1 ? "day" : "days"}.
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="page-title mb-md" style={{ fontSize: 16 }}>History</h2>
        {logs && logs.length > 0 ? (
          <div className="card card--flush" style={{ padding: "4px 20px" }}>
            <ul className="hist">
              {logs.map((l) => (
                <li key={l.id}>
                  <span className="num meta" style={{ width: 92 }}>{l.local_date}</span>
                  <span className="num" style={{ width: 56, fontWeight: 700 }}>+{l.pages_read}</span>
                  {l.end_page && <span className="num meta" style={{ width: 62 }}>p.{l.end_page}</span>}
                  {l.note && <span className="meta truncate">{l.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="meta">No entries yet.</p>
        )}
      </section>
    </div>
  );
}
