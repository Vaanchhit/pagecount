"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { findUsers, sendRequest, acceptRequest, removeFriendship } from "@/app/actions/social";
import Icon from "./Icon";

type Person = { id: string; name: string; username: string };
type Found = { id: string; username: string; display_name: string | null };

const initials = (s: string) => s.trim().slice(0, 2).toUpperCase();

export default function FriendManager({
  mode = "search", requests = [],
}: { mode?: "search" | "requests" | "list" | "outgoing"; requests?: Person[] }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (mode !== "search") {
    return (
      <ul className="feed">
        {requests.filter((r) => !done.has(r.id)).map((r) => (
          <li key={r.id} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <span className="avatar">{initials(r.name)}</span>
              <Link href={`/u/${r.username}`} className="grow truncate" style={{ color: "var(--text)" }}>
                {r.name}
              </Link>

              {mode === "requests" ? (
                <>
                  <button
                    className="btn btn--primary" disabled={pending}
                    onClick={() => start(async () => { await acceptRequest(r.id); setDone((p) => new Set(p).add(r.id)); })}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn--quiet" disabled={pending}
                    onClick={() => start(async () => { await removeFriendship(r.id); setDone((p) => new Set(p).add(r.id)); })}
                  >
                    Ignore
                  </button>
                </>
              ) : (
                <button
                  className="btn btn--quiet" disabled={pending}
                  onClick={() => start(async () => { await removeFriendship(r.id); setDone((p) => new Set(p).add(r.id)); })}
                >
                  {mode === "outgoing" ? "Cancel" : "Remove"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function run() {
    if (q.trim().length < 2) return;
    start(async () => {
      const res = await findUsers(q);
      setFound(res);
      setMsg(res.length === 0 ? "No one by that name." : null);
    });
  }

  return (
    <div>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <label className="field grow">
          <Icon name="users" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Search by username" aria-label="Search for a reader"
          />
        </label>
        <button className="btn btn--primary" onClick={run} disabled={pending || q.trim().length < 2}>Search</button>
      </div>

      {msg && <p className="meta mt-md">{msg}</p>}

      {found.length > 0 && (
        <ul className="feed mt-md">
          {found.map((p) => (
            <li key={p.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <span className="avatar">{initials(p.display_name || p.username)}</span>
                <div className="grow">
                  <p className="truncate" style={{ fontWeight: 600 }}>{p.display_name || p.username}</p>
                  <p className="meta truncate">@{p.username}</p>
                </div>
                <button
                  className="btn" disabled={pending || sent.has(p.id)}
                  onClick={() => start(async () => {
                    const res = await sendRequest(p.id);
                    if (res.error) setMsg(res.error); else setSent((prev) => new Set(prev).add(p.id));
                  })}
                >
                  {sent.has(p.id) ? "Sent" : "Add friend"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
