import Link from "next/link";
import type { LeaderRow } from "@/lib/types";

export default function Leaderboard({ rows, meId }: { rows: LeaderRow[]; meId: string }) {
  if (rows.length <= 1) {
    return <p className="meta">Add a friend and you&apos;ll both show up here.</p>;
  }
  const top = rows[0]?.pages || 1;

  return (
    <ol className="ldr">
      {rows.map((r, i) => {
        const isMe = r.user_id === meId;
        return (
          <li key={r.user_id}>
            <span className="ldr__rank">{i + 1}</span>
            <Link
              href={`/u/${r.username}`}
              className="grow truncate"
              style={{ color: "var(--text)", fontWeight: isMe ? 700 : 400, fontSize: 13 }}
            >
              {isMe ? "You" : r.display_name || r.username}
            </Link>
            <span className="progress ldr__bar">
              <span style={{ width: `${Math.max(4, Math.round((r.pages / top) * 100))}%` }} />
            </span>
            <span className="num meta" style={{ width: 38, textAlign: "right", color: "var(--text)" }}>
              {r.pages}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
