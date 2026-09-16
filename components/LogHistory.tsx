"use client";

import { useState, useTransition } from "react";
import { deleteLog } from "@/app/actions/books";

type LogRow = {
  id: string;
  pages_read: number;
  end_page: number | null;
  note: string | null;
  local_date: string;
};

export default function LogHistory({
  userBookId, logs, canDelete,
}: { userBookId: string; logs: LogRow[]; canDelete: boolean }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const visible = logs.filter((l) => !removed.has(l.id));
  if (visible.length === 0) return <p className="meta">No entries yet.</p>;

  return (
    <div className="card card--flush" style={{ padding: "4px 20px" }}>
      <ul className="hist">
        {visible.map((l) => (
          <li key={l.id}>
            <span className="num meta" style={{ width: 92 }}>{l.local_date}</span>
            <span className="num" style={{ width: 56, fontWeight: 700 }}>+{l.pages_read}</span>
            {l.end_page && <span className="num meta" style={{ width: 62 }}>p.{l.end_page}</span>}
            {l.note && <span className="meta truncate grow">{l.note}</span>}
            {canDelete && (
              <button
                type="button"
                className="meta"
                aria-label="Delete this entry"
                disabled={pending}
                style={{ marginLeft: "auto", border: 0, background: "none", cursor: "pointer", padding: 4 }}
                onClick={() => start(async () => {
                  const res = await deleteLog(l.id, userBookId);
                  if (!res.error) setRemoved((prev) => new Set(prev).add(l.id));
                })}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
