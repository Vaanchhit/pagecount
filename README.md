# Pagecount

A reading tracker built around one idea: **the streak should be honest**. No
manual "mark today as read" button to game, no counter that drifts out of
sync — every number on screen is recomputed from the actual log of pages you
entered, every time.

Next.js 16 (App Router) + Supabase, with a from-scratch design system —
no Tailwind, no component kit.

---

## Use cases

**Keep a reading habit without lying to yourself.**
Log the page you're on after a session. Pagecount works out the delta since
your last entry, updates your streak, and colors in today's square on your
contribution grid. Miss a day and the streak breaks — unless you'd already
built one, in which case an automatic freeze (one per calendar month) covers
a single missed day so one bad night doesn't erase a three-week run.

**Read with friends, not at them.**
Add friends, and their activity shows up in your feed as they log — no
posting required on their end, no performance. A weekly leaderboard ranks
your friend group by pages read in the last 7 days, so a group chat book
club has something to actually compare.

**See progress on the book you're mid-way through, not just the shelf.**
Every book you're reading gets a pace estimate: pages/day based on days you
actually read (not calendar days), and a rough "N days left at this pace."
Progress is tracked by page position, so re-reading a chapter doesn't wreck
the delta math underneath it.

**Show off a public reading profile.**
Every user gets a `/u/username` page — streak, badges, and shelf, visible to
whoever you let see it. Row-level security decides what's public versus
friends-only at the database layer, not in application code, so there's no
route that can accidentally leak someone's private reading list.

**Hit milestones without anyone shipping a deploy for them.**
Badges (streak tiers, pages read, books finished) are rows in a catalogue
table, evaluated and awarded inside the database the moment you qualify.
Adding a new tier is an `INSERT`, not a release.

---

## How it works

1. **Sign in** with a magic link or Google.
2. **Onboarding** — pick a username, a display name, and a daily page goal.
   Timezone is captured automatically from the browser, because a streak
   that keys off UTC breaks the moment you read past midnight.
3. **Add a book** — search pulls from Open Library; add it to your shelf.
4. **Log pages** — tell it what page you're on. It computes and stores the
   delta, updates your streak and contribution grid, and checks whether you
   just earned a badge.
5. **Add friends** — see their logs in your feed, compare weekly pages on
   the leaderboard, and check in on their profile pages.

---

## Getting started

### 1. Supabase

Create a project, then run the four migrations **in order** in the SQL editor:

```
supabase/migrations/0001_schema.sql     tables, types, indexes
supabase/migrations/0002_functions.sql  streak, freeze, badges, pace, feed
supabase/migrations/0003_rls.sql        row level security
supabase/migrations/0004_seed.sql       badge catalogue + signup trigger
```

Or with the CLI: `supabase db push`.

In **Authentication → Providers**, enable Email (magic link) and, if you want it,
Google. Add `https://your-app.vercel.app/auth/callback` to the redirect allow list,
and set **Authentication → URL Configuration → Site URL** to your deployed domain —
otherwise auth redirects fall back to whatever's configured there (often `localhost`).

### 2. Local

```bash
cp .env.example .env.local     # fill in URL + anon key from Settings → API
npm install
npm run dev
```

### 3. Deploy

Import the repo into Vercel (or similar), add the same two environment
variables, deploy. The app is also installable as a PWA out of the box.

---

## Engineering notes

A few decisions that aren't obvious from reading the code top to bottom:

**Pages are logged as a position, not a delta.** The input asks what page
you're on; the server computes the delta from your last entry in that book
and stores both. The delta drives streaks, badges, and the grid; the
position drives progress bars and survives re-reading a chapter. Removing
either breaks the other.

**Streaks are derived, never counted.** `get_streak()` runs a
gaps-and-islands query over the log table on every read. There is no
`current_streak` column and no nightly cron. A stored counter drifts when
the cron misfires and can't be recomputed afterward; this approach can, and
backdating an entry just works.

**`local_date` is not decoration.** It's the date in the *user's* timezone,
written at insert. A 00:40 IST log is 19:10 UTC the previous day — key
streaks off the timestamp and you'll double-count one day and punch a hole
in the next. Every streak and grid query uses this column instead.

**Shelf entries archive, they don't delete.** There is deliberately no
DELETE policy on `user_books`. Hard-deleting a book would take its reading
logs with it and silently rewrite streak history.

**Badges and freezes are awarded inside the database**, via
`security definer` triggers, so a client bug or a direct SQL write can't
skip or forge them — `user_badges` and `streak_freezes` have no INSERT
policy at all.

**The monthly freeze is enforced by a unique constraint**, `(user_id,
month_key)`, not by application logic. It's spent automatically when a log
bridges exactly one missed day and there's a real run behind it worth
saving.

**The contribution grid buckets intensity relative to each reader's own
distribution**, not absolute page counts. Hardcode "80+ pages = darkest" and
a heavy reader sees a solid block while a light reader sees nothing — the
grid stops carrying information in either direction.

---

## Styling

The whole system lives in `app/globals.css`: design tokens at the top, then
the base stylesheet, then a Pagecount-specific section built from the same
tokens. There is no Tailwind — to restyle, edit the token block.

Mode is per route group: `/login` is marketing mode (the display typeface);
everything under `app/(app)/` wraps in `.app` (Inter, 14px base). The
display face draws every capital letter as a swash, including **I** as a
**J** — keep capital I out of any display-font text, or "Level II" reads as
"Level JJ."

---

## Routes

| Path | What it is |
|---|---|
| `/login` | Magic link + Google |
| `/onboarding` | Username, display name, page goal, timezone capture |
| `/library` | Shelf + the full personal sidebar |
| `/book/[id]` | Progress, pace estimate, full log history |
| `/feed` | Friends' activity |
| `/friends` | Search, requests, current friends |
| `/badges` | Every tier, earned and locked |
| `/u/[username]` | Public profile — RLS decides what's visible |

---

## Extending it

**Adding a badge tier** is an insert, no deploy needed:

```sql
insert into badges (key, name, description, kind, threshold, tier)
values ('streak_200', 'Two hundred', 'Two hundred consecutive days', 'streak', 200, 9);
```

**Collapsing the feed.** Right now it's one card per log entry. If someone
starts logging five times an evening and floods it, group by `(user_id,
user_book_id, local_date)` and sum `pages_read` inside `get_feed()` — the UI
consumes the same row shape either way, so nothing in React changes.
