export type ShelfStatus = "reading" | "finished" | "want_to_read";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  daily_page_goal: number;
};

export type Streak = {
  current_streak: number;
  longest_streak: number;
  last_active: string | null;
  total_days: number;
};

export type Stats = {
  total_pages: number;
  books_finished: number;
  books_reading: number;
  pages_today: number;
};

export type ActivityDay = { day: string; pages: number; frozen: boolean };

export type BookProgress = {
  pages_total: number;
  current_page: number | null;
  total_pages: number | null;
  percent: number | null;
  active_days: number;
  pages_per_day: number | null;
  days_remaining: number | null;
};

export type ShelfBook = {
  id: string;             // user_books.id
  status: ShelfStatus;
  finished_at: string | null;
  books: {
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
    total_pages: number | null;
  };
};

export type FeedEntry = {
  log_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  book_title: string;
  book_author: string | null;
  cover_url: string | null;
  pages_read: number;
  end_page: number | null;
  total_pages: number | null;
  note: string | null;
  logged_at: string;
  finished: boolean;
};

export type LeaderRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  pages: number;
  days_active: number;
};

export type Badge = {
  key: string;
  name: string;
  description: string;
  kind: "streak" | "pages" | "books";
  threshold: number;
  tier: number;
};

/**
 * Bucket a day's page count into one of four intensities.
 *
 * Buckets are relative to this reader's own distribution, not absolute.
 * Hardcoding "80+ pages = darkest" makes a heavy reader's grid a solid
 * block and a light reader's grid empty — the grid stops carrying
 * information in both directions.
 */
export function intensityScale(days: ActivityDay[]) {
  const active = days.filter((d) => d.pages > 0).map((d) => d.pages).sort((a, b) => a - b);

  if (active.length === 0) return () => 0;

  const at = (q: number) => active[Math.min(active.length - 1, Math.floor(active.length * q))];
  const cuts = [at(0.25), at(0.5), at(0.75)];

  return (pages: number) => {
    if (pages <= 0) return 0;
    if (pages <= cuts[0]) return 1;
    if (pages <= cuts[1]) return 2;
    if (pages <= cuts[2]) return 3;
    return 4;
  };
}

/** Local YYYY-MM-DD for a Date, without UTC drift. */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
