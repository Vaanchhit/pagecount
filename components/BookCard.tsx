"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { logProgress, finishBook } from "@/app/actions/books";
import type { ShelfBook } from "@/lib/types";

/** Covers are images, so they get a sketch frame: ink outline plus shadow. */
export function Cover({
  url, title, w = 56, h = 84,
}: { url: string | null; title: string; w?: number; h?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="cover" width={w} height={h} style={{ width: w, height: h }} loading="lazy" />;
  }
  // Rose-filled stand-in for a plain cloth binding with the title stamped on.
  return (
    <span className="cover cover--blank" style={{ width: w, height: h }}>
      <span className="clamp-2">{title}</span>
    </span>
  );
}

export default function BookCard({
  book, progress,
}: {
  book: ShelfBook;
  progress?: { current_page: number | null; percent: number | null; days_remaining: number | null };
}) {
  const [open, setOpen] = useState(false);
  const b = book.books;

  return (
    <>
      <div className="card">
        <div className="book-row">
          <Link href={`/book/${book.id}`} aria-label={b.title}>
            <Cover url={b.cover_url} title={b.title} />
          </Link>

          <div className="book-row__body">
            <Link href={`/book/${book.id}`} style={{ color: "var(--text)" }}>
              <h3 className="book-title clamp-2">{b.title}</h3>
              {b.author && <p className="meta truncate">{b.author}</p>}
            </Link>

            {progress && b.total_pages ? (
              <div style={{ marginTop: "auto", paddingTop: 12 }}>
                <span className="progress">
                  <span style={{ width: `${progress.percent ?? 0}%` }} />
                </span>
                <div className="between mt-sm">
                  <span className="meta num">Page {progress.current_page ?? 0} of {b.total_pages}</span>
                  {progress.days_remaining !== null && progress.days_remaining > 0 && (
                    <span className="meta num">~{progress.days_remaining}d left</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="meta" style={{ marginTop: "auto", paddingTop: 12 }}>Not started</p>
            )}
          </div>

          {book.status === "reading" && (
            <button className="btn btn--primary" style={{ alignSelf: "center" }} onClick={() => setOpen(true)}>
              Log pages
            </button>
          )}
        </div>
      </div>

      {open && (
        <LogDialog
          userBookId={book.id}
          title={b.title}
          totalPages={b.total_pages}
          startAt={progress?.current_page ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function LogDialog({
  userBookId, title, totalPages, startAt, onClose,
}: {
  userBookId: string; title: string; totalPages: number | null;
  startAt: number | null; onClose: () => void;
}) {
  const [page, setPage] = useState(startAt ? String(startAt) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ pagesRead: number; reachedEnd: boolean } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await logProgress(userBookId, Number(page), note);
      if (res.error) return setError(res.error);
      setResult({ pagesRead: res.pagesRead!, reachedEnd: !!res.reachedEnd });
      if (!res.reachedEnd) setTimeout(onClose, 900);
    });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={`Log progress on ${title}`} onClick={(e) => e.stopPropagation()}>
        {result?.reachedEnd ? (
          <div>
            <h2 className="page-title">That&apos;s the last page.</h2>
            <p className="meta mt-sm mb-md">Close out {title}?</p>
            <div className="row sketch-set">
              <button
                className="btn btn--primary"
                disabled={pending}
                onClick={() => start(async () => { await finishBook(userBookId); onClose(); })}
              >
                Mark it finished
              </button>
              <button className="btn" onClick={onClose}>Not yet</button>
            </div>
          </div>
        ) : result ? (
          <p className="num center" style={{ font: "700 26px/1.2 var(--font-ui)", padding: "24px 0" }}>
            +{result.pagesRead} {result.pagesRead === 1 ? "page" : "pages"}
          </p>
        ) : (
          <div>
            <h2 className="page-title">{title}</h2>
            <p className="meta mt-sm mb-md">
              What page are you on?{totalPages ? ` Of ${totalPages}.` : ""}
            </p>

            <label className="field">
              <input
                type="number" inputMode="numeric" autoFocus className="bigfield"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={startAt ? String(startAt + 20) : "1"}
                aria-label="Current page"
              />
            </label>

            <label className="field mt-sm">
              <input
                type="text" maxLength={500} value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="A note, if you want"
                aria-label="Note"
              />
            </label>

            {error && <p className="error mt-sm">{error}</p>}

            <div className="row sketch-set mt-md">
              <button className="btn btn--primary" onClick={submit} disabled={pending || !page}>
                {pending ? "Saving" : "Save progress"}
              </button>
              <button className="btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
