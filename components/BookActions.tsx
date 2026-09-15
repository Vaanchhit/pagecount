"use client";

import { useState, useTransition } from "react";
import { LogDialog } from "./BookCard";
import { finishBook, reopenBook, archiveBook } from "@/app/actions/books";

export default function BookActions({
  userBookId, title, totalPages, currentPage, status,
}: {
  userBookId: string; title: string; totalPages: number | null;
  currentPage: number | null; status: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <div className="row sketch-set">
        {status !== "finished" ? (
          <>
            <button className="btn btn--primary" onClick={() => setOpen(true)}>Log pages</button>
            <button className="btn" disabled={pending} onClick={() => start(async () => { await finishBook(userBookId); })}>
              Mark finished
            </button>
          </>
        ) : (
          <button className="btn" disabled={pending} onClick={() => start(async () => { await reopenBook(userBookId); })}>
            Reading again
          </button>
        )}

        <button
          className="btn btn--quiet"
          disabled={pending}
          title="Takes it off your shelf. Pages you logged stay in your streak."
          onClick={() => start(async () => { await archiveBook(userBookId); })}
        >
          Remove from shelf
        </button>
      </div>

      {open && (
        <LogDialog
          userBookId={userBookId} title={title} totalPages={totalPages}
          startAt={currentPage} onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
