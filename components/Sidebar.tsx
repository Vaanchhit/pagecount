import Link from "next/link";
import StreakRing from "./StreakRing";
import StreakGrid from "./StreakGrid";
import BadgeShelf from "./BadgeShelf";
import Leaderboard from "./Leaderboard";
import Icon from "./Icon";
import type { ActivityDay, Badge, LeaderRow, Profile, Stats, Streak } from "@/lib/types";

export default function Sidebar({
  profile, streak, stats, activity, catalogue, earned, leaderboard,
}: {
  profile: Profile; streak: Streak; stats: Stats; activity: ActivityDay[];
  catalogue: Badge[]; earned: { badge_key: string; earned_at: string }[]; leaderboard: LeaderRow[];
}) {
  return (
    <aside className="shell__side sketch-set">
      <section className="card">
        <StreakRing streak={streak} pagesToday={stats.pages_today} goal={profile.daily_page_goal} />
      </section>

      <section className="card">
        <StreakGrid activity={activity} />
      </section>

      <section className="card">
        <dl className="row" style={{ gap: 0, justifyContent: "space-between", margin: 0 }}>
          {([
            ["Pages", stats.total_pages, "book"],
            ["Finished", stats.books_finished, "check"],
            ["Reading", stats.books_reading, "flame"],
          ] as const).map(([label, value, icon], i) => (
            <div key={label} style={{ textAlign: "left" }}>
              <span className={`icon-badge ${["", "tint-sky", "tint-mint"][i]}`}><Icon name={icon} /></span>
              <dd className="stat__value" style={{ margin: "10px 0 0" }}>{value}</dd>
              <dt className="stat__label" style={{ marginTop: 2 }}>{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="card">
        <div className="between mb-md">
          <h2 className="page-title" style={{ fontSize: 16 }}>This week</h2>
          <Link href="/friends" className="meta">Friends</Link>
        </div>
        <Leaderboard rows={leaderboard} meId={profile.id} />
      </section>

      <section className="card">
        <div className="between mb-md">
          <h2 className="page-title" style={{ fontSize: 16 }}>Badges</h2>
          <Link href="/badges" className="meta">All</Link>
        </div>
        <BadgeShelf catalogue={catalogue} earned={earned} compact />
      </section>
    </aside>
  );
}
