import type { Streak } from "@/lib/types";

/**
 * Streak count inside a progress ring for today's goal.
 *
 * Ring and streak are deliberately decoupled: the streak survives on a
 * single page, the ring only tracks the goal. Tie them together and one
 * light day kills a forty-day run, which is why people quit habit apps.
 *
 * Circles stay geometrically true — no wobble on round parts.
 */
export default function StreakRing({
  streak, pagesToday, goal,
}: { streak: Streak; pagesToday: number; goal: number }) {
  const pct = Math.min(1, goal > 0 ? pagesToday / goal : 0);
  const R = 31;
  const C = 2 * Math.PI * R;
  const met = pct >= 1;

  return (
    <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
      <div className="ring">
        <svg viewBox="0 0 78 78" width="78" height="78" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx="39" cy="39" r={R} fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
          <circle
            cx="39" cy="39" r={R} fill="none"
            stroke={met ? "var(--rose-ink)" : "var(--rose)"}
            strokeWidth="7" strokeLinecap="butt"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          />
          <circle cx="39" cy="39" r={R} fill="none" stroke="var(--ink)" strokeWidth="2" />
        </svg>
        <span className="ring__value">{streak.current_streak}</span>
      </div>

      <div className="grow">
        <div style={{ font: "700 15px/1.3 var(--font-ui)" }}>
          {streak.current_streak === 0
            ? "No streak yet"
            : `${streak.current_streak} day${streak.current_streak === 1 ? "" : "s"} running`}
        </div>
        <div className="meta num mt-sm">{pagesToday} of {goal} pages today</div>
        {streak.longest_streak > streak.current_streak && (
          <div className="meta num">Best {streak.longest_streak}</div>
        )}
      </div>
    </div>
  );
}
