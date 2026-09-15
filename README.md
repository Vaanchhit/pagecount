# Pagecount

Track what you read, keep a daily streak, and see what your friends are reading.

Next.js 16 + Supabase. Styled with Sketchbook Brutalism.

---

## Setup

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
Google. Add `https://your-app.vercel.app/auth/callback` to the redirect allow list.

### 2. Local

```bash
cp .env.example .env.local     # fill in URL + anon key from Settings → API
npm install
npm run dev
```

### 3. Vercel

Import the repo, add the same two environment variables, deploy.

---

## Things worth knowing before you change anything

**Pages are logged as a position, not a delta.** The input asks what page you're
on; the server computes the delta from your last entry in that book and stores
both. The delta drives streaks, badges, and the grid; the position drives
progress bars and survives re-reading a chapter. Removing either breaks the
other.

**Streaks are derived, never counted.** `get_streak()` runs a gaps-and-islands
query over the log table. There is no `current_streak` column and no nightly
cron. A stored counter drifts when the cron misfires and can't be recomputed
afterwards; this can, and backdating an entry just works.

**`local_date` is not decoration.** It's the date in the *user's* timezone,
written at insert. A 00:40 IST log is 19:10 UTC the previous day — key streaks
off the timestamp and you'll double-count one day and punch a hole in the next.
Every streak and grid query uses this column.

**Shelf entries archive, they don't delete.** There is deliberately no DELETE
policy on `user_books`. Hard-deleting a book would take its reading logs with
it and silently rewrite streak history.

**Badges and freezes are awarded in the database.** Both run in
`security definer` triggers, so a client bug or a direct SQL write can't skip
or forge them. `user_badges` and `streak_freezes` have no INSERT policy at all.

**The freeze is one per calendar month**, enforced by a unique constraint on
`(user_id, month_key)` — not by application logic. It's spent automatically
when a log bridges exactly one missed day and there's a real run to save.

---

## Styling

The whole system lives in `app/globals.css`: tokens at the top, the design
system stylesheet, then a Pagecount section built from the same tokens. There
is no Tailwind. To restyle, edit the token block.

Mode is per route group. `/login` is marketing mode (display face); everything
under `app/(app)/` wraps in `.app` (Inter, 14px base). Keep capital **I** out of
any display-font text — every capital in that face is a swash and I is drawn
like a J, so "Level II" reads "Level JJ". Use `.ui` to force Inter on an element
that needs one.

The contribution grid buckets intensity **relative to each reader's own
distribution**, not absolute page counts. Hardcode "80+ pages = darkest" and a
heavy reader sees a solid block while a light reader sees nothing — the grid
stops carrying information in both directions.

---

## Adding a badge tier

Insert a row. No deploy needed.

```sql
insert into badges (key, name, description, kind, threshold, tier)
values ('streak_200', 'Two hundred', 'Two hundred consecutive days', 'streak', 200, 9);
```

## Collapsing the feed

Right now the feed is one card per log entry. If someone starts logging five
times an evening and floods it, group by `(user_id, user_book_id, local_date)`
and sum `pages_read` inside `get_feed()`. The UI consumes the same row shape
either way, so nothing in React changes.

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
# pagecount
