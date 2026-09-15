import type { Badge } from "@/lib/types";

type Earned = { badge_key: string; earned_at: string };

/**
 * Earned achievements filled rose, locked ones outlined on paper-2.
 * Showing the locked tiers is the point — an empty shelf tells you
 * nothing about what's next.
 */
export default function BadgeShelf({
  catalogue, earned, compact = false,
}: { catalogue: Badge[]; earned: Earned[]; compact?: boolean }) {
  const has = new Set(earned.map((e) => e.badge_key));
  const kinds: Badge["kind"][] = ["streak", "pages", "books"];
  const labels: Record<Badge["kind"], string> = {
    streak: "Streaks", pages: "Pages read", books: "Books finished",
  };

  if (compact) {
    const won = catalogue.filter((b) => has.has(b.key)).slice(-6);
    if (won.length === 0) {
      return <p className="meta">Log a few days and these start filling in.</p>;
    }
    return (
      <div className="row" style={{ gap: 8 }}>
        {won.map((b) => <span key={b.key} className="badge" title={b.description}>{b.name}</span>)}
      </div>
    );
  }

  return (
    <div className="stack">
      {kinds.map((kind) => (
        <section key={kind}>
          <h3 className="page-title mb-sm" style={{ fontSize: 16 }}>{labels[kind]}</h3>
          <div className="trophy-grid">
            {catalogue
              .filter((b) => b.kind === kind)
              .sort((a, b) => a.tier - b.tier)
              .map((b) => (
                <div key={b.key} className="trophy" data-earned={has.has(b.key) ? "true" : "false"}>
                  <div className="trophy__name">{b.name}</div>
                  <div className="trophy__desc">{b.description}</div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
