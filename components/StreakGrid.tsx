"use client";

import { useMemo, useState } from "react";
import { intensityScale, isoDate, type ActivityDay } from "@/lib/types";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function StreakGrid({ activity, weeks = 53 }: { activity: ActivityDay[]; weeks?: number }) {
  const [hover, setHover] = useState<{ date: string; pages: number; frozen: boolean } | null>(null);

  const { columns, monthLabels } = useMemo(() => {
    const byDate = new Map(activity.map((a) => [a.day, a]));

    // Walk back to the Sunday that opens the window so every column is a
    // clean week and the weekday rows line up.
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks * 7 - 1));

    const cols: { date: string; pages: number; frozen: boolean; future: boolean }[][] = [];
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;

    const cursor = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col: (typeof cols)[number] = [];
      for (let d = 0; d < 7; d++) {
        const key = isoDate(cursor);
        const hit = byDate.get(key);
        col.push({ date: key, pages: hit?.pages ?? 0, frozen: hit?.frozen ?? false, future: cursor > today });
        if (d === 0 && cursor.getMonth() !== lastMonth) {
          lastMonth = cursor.getMonth();
          labels.push({ col: w, label: MONTHS[lastMonth] });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return { columns: cols, monthLabels: labels };
  }, [activity, weeks]);

  const level = useMemo(() => intensityScale(activity), [activity]);
  const daysRead = activity.filter((a) => a.pages > 0).length;

  return (
    <div>
      <div className="gridwrap">
        <div>
          <div className="gridlabels">
            {columns.map((_, i) => (
              <span key={i} className="gridlabel">
                {monthLabels.find((l) => l.col === i)?.label ?? ""}
              </span>
            ))}
          </div>

          <div className="gridcols">
            <div className="griddays">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => <span key={i}>{d}</span>)}
            </div>

            {columns.map((col, ci) => (
              <div key={ci} className="gridcol">
                {col.map((cell) => (
                  <span
                    key={cell.date}
                    className="gcell"
                    data-lvl={cell.future ? undefined : level(cell.pages)}
                    data-frozen={cell.frozen && cell.pages === 0 ? "true" : undefined}
                    data-future={cell.future ? "true" : undefined}
                    onMouseEnter={() => !cell.future && setHover({ date: cell.date, pages: cell.pages, frozen: cell.frozen })}
                    onMouseLeave={() => setHover(null)}
                    title={
                      cell.future ? ""
                      : cell.frozen && cell.pages === 0 ? `${cell.date} — streak freeze`
                      : `${cell.date} — ${cell.pages} ${cell.pages === 1 ? "page" : "pages"}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="between mt-sm">
        <span className="meta num">
          {hover
            ? hover.frozen && hover.pages === 0
              ? `Freeze used on ${hover.date}`
              : `${hover.pages} ${hover.pages === 1 ? "page" : "pages"} on ${hover.date}`
            : `${daysRead} days read this year`}
        </span>
        <span className="gridkey meta">
          Less
          {[0, 1, 2, 3, 4].map((l) => <span key={l} className="gcell" data-lvl={l} />)}
          More
        </span>
      </div>
    </div>
  );
}
