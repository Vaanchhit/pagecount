-- ============================================================
-- 0002_functions.sql — all derived logic lives here, not in TypeScript,
-- so the numbers are identical from the sidebar, the feed, a future
-- mobile client, or a psql prompt.
-- ============================================================

-- ------------------------------------------------------------
-- Today, in the user's own timezone.
-- ------------------------------------------------------------
create or replace function public.current_local_date(uid uuid)
returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(
    (select timezone from profiles where id = uid), 'UTC'
  ))::date;
$$;

-- ------------------------------------------------------------
-- Are these two accepted friends?
-- ------------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

create or replace function public.friend_ids(uid uuid)
returns table (friend_id uuid)
language sql stable security definer set search_path = public as $$
  select case when requester_id = uid then addressee_id else requester_id end
  from friendships
  where status = 'accepted' and (requester_id = uid or addressee_id = uid);
$$;

-- ------------------------------------------------------------
-- Streak, via gaps-and-islands.
--
-- Derived from the log table on every read rather than stored as a counter.
-- A stored counter needs a nightly cron to break streaks, drifts when the
-- cron misfires, and is unfixable afterwards because the information needed
-- to recompute is gone. This is O(days) over a few hundred rows.
--
-- Freeze days are unioned into the day set, so a frozen gap doesn't split
-- the run.
-- ------------------------------------------------------------
create or replace function public.get_streak(uid uuid)
returns table (current_streak int, longest_streak int, last_active date, total_days int)
language sql stable security definer set search_path = public as $$
  with today as (
    select current_local_date(uid) as d
  ),
  days as (
    select distinct local_date as d from reading_logs where user_id = uid
    union
    select used_on from streak_freezes where user_id = uid
  ),
  grouped as (
    -- consecutive dates share a constant (date - row_number)
    select d, d - (row_number() over (order by d))::int as grp from days
  ),
  runs as (
    select grp, max(d) as end_d, count(*)::int as len
    from grouped group by grp
  )
  select
    -- counts as current if the run reaches today or yesterday; you have
    -- until the end of today to keep it alive
    coalesce((
      select r.len from runs r, today t
      where r.end_d in (t.d, t.d - 1)
      order by r.end_d desc limit 1
    ), 0),
    coalesce((select max(len) from runs), 0),
    (select max(d) from days),
    (select count(*)::int from days);
$$;

-- ------------------------------------------------------------
-- Apply a freeze if today's log bridges a single missed day.
--
-- Fires on insert. Conditions, all required:
--   * exactly one day was missed (yesterday), and
--   * the day before that had activity (there's a real run to save), and
--   * no freeze has been used this calendar month.
-- The unique constraint on (user_id, month_key) is the real enforcement;
-- this is just the trigger that decides when to spend it.
-- ------------------------------------------------------------
create or replace function public.maybe_apply_freeze()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  gap_day    date;
  before_gap date;
begin
  gap_day    := new.local_date - 1;
  before_gap := new.local_date - 2;

  -- yesterday already covered? nothing to save
  if exists (select 1 from reading_logs
             where user_id = new.user_id and local_date = gap_day)
     or exists (select 1 from streak_freezes
                where user_id = new.user_id and used_on = gap_day) then
    return new;
  end if;

  -- nothing before the gap means there's no run to preserve
  if not exists (select 1 from reading_logs
                 where user_id = new.user_id and local_date = before_gap)
     and not exists (select 1 from streak_freezes
                     where user_id = new.user_id and used_on = before_gap) then
    return new;
  end if;

  begin
    insert into streak_freezes (user_id, used_on, month_key)
    values (new.user_id, gap_day, to_char(gap_day, 'YYYY-MM'));
  exception when unique_violation then
    -- freeze already spent this month; the streak breaks, as intended
    null;
  end;

  return new;
end $$;

-- ------------------------------------------------------------
-- Award any badges the user has newly qualified for.
-- Runs in the database so a client bug or a direct SQL write can't skip it.
-- ------------------------------------------------------------
create or replace function public.evaluate_badges(uid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_streak int;
  v_pages  int;
  v_books  int;
begin
  select current_streak into v_streak from get_streak(uid);

  select coalesce(sum(pages_read), 0)::int into v_pages
  from reading_logs where user_id = uid;

  select count(*)::int into v_books
  from user_books where user_id = uid and status = 'finished';

  insert into user_badges (user_id, badge_key)
  select uid, b.key
  from badges b
  where (b.kind = 'streak' and v_streak >= b.threshold)
     or (b.kind = 'pages'  and v_pages  >= b.threshold)
     or (b.kind = 'books'  and v_books  >= b.threshold)
  on conflict (user_id, badge_key) do nothing;
end $$;

create or replace function public.trg_evaluate_badges()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform evaluate_badges(coalesce(new.user_id, old.user_id));
  return new;
end $$;

create trigger reading_logs_freeze
  before insert on public.reading_logs
  for each row execute function public.maybe_apply_freeze();

create trigger reading_logs_badges
  after insert on public.reading_logs
  for each row execute function public.trg_evaluate_badges();

create trigger user_books_badges
  after update of status on public.user_books
  for each row when (new.status = 'finished')
  execute function public.trg_evaluate_badges();

-- ------------------------------------------------------------
-- Contribution grid: one row per active day over a window.
-- Zero days are omitted; the client fills the calendar and buckets
-- intensity against this user's own distribution.
-- ------------------------------------------------------------
create or replace function public.get_activity(uid uuid, days_back int default 365)
returns table (day date, pages int, frozen boolean)
language sql stable security definer set search_path = public as $$
  with window_start as (
    select current_local_date(uid) - days_back as d
  )
  select
    coalesce(l.local_date, f.used_on) as day,
    coalesce(l.pages, 0)              as pages,
    (f.used_on is not null)           as frozen
  from (
    select local_date, sum(pages_read)::int as pages
    from reading_logs, window_start
    where user_id = uid and local_date >= window_start.d
    group by local_date
  ) l
  full outer join (
    select used_on from streak_freezes, window_start
    where user_id = uid and used_on >= window_start.d
  ) f on f.used_on = l.local_date
  order by 1;
$$;

-- ------------------------------------------------------------
-- Per-book progress + pace.
-- Pace uses days actually read on, not calendar days, so a week off
-- doesn't make you look slow.
-- ------------------------------------------------------------
create or replace function public.get_book_progress(ub_id uuid)
returns table (
  pages_total     int,
  current_page    int,
  total_pages     int,
  percent         numeric,
  active_days     int,
  pages_per_day   numeric,
  days_remaining  int
)
language sql stable security definer set search_path = public as $$
  with agg as (
    select
      coalesce(sum(pages_read), 0)::int          as pages_total,
      count(distinct local_date)::int            as active_days,
      max(end_page)                              as current_page
    from reading_logs where user_book_id = ub_id
  ),
  bk as (
    select b.total_pages
    from user_books ub join books b on b.id = ub.book_id
    where ub.id = ub_id
  )
  select
    agg.pages_total,
    coalesce(agg.current_page, agg.pages_total),
    bk.total_pages,
    case when bk.total_pages > 0
      then round(100.0 * least(coalesce(agg.current_page, agg.pages_total), bk.total_pages) / bk.total_pages, 0)
      else null end,
    agg.active_days,
    case when agg.active_days > 0
      then round(agg.pages_total::numeric / agg.active_days, 1)
      else null end,
    case when bk.total_pages > 0 and agg.active_days > 0 and agg.pages_total > 0
      then ceil(
        greatest(bk.total_pages - coalesce(agg.current_page, agg.pages_total), 0)
        / (agg.pages_total::numeric / agg.active_days)
      )::int
      else null end
  from agg, bk;
$$;

-- ------------------------------------------------------------
-- Weekly leaderboard: you + accepted friends, pages over the last 7
-- local days.
-- ------------------------------------------------------------
create or replace function public.weekly_leaderboard(uid uuid)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  pages        int,
  days_active  int
)
language sql stable security definer set search_path = public as $$
  with cohort as (
    select uid as id
    union
    select friend_id from friend_ids(uid)
  ),
  since as (select current_local_date(uid) - 6 as d)
  select
    p.id, p.username, p.display_name, p.avatar_url,
    coalesce(sum(l.pages_read), 0)::int,
    count(distinct l.local_date)::int
  from cohort c
  join profiles p on p.id = c.id
  left join reading_logs l
    on l.user_id = p.id and l.local_date >= (select d from since)
  group by p.id, p.username, p.display_name, p.avatar_url
  order by 5 desc, 6 desc;
$$;

-- ------------------------------------------------------------
-- Friend feed. One row per log entry.
--
-- To collapse to one card per person-per-book-per-day later, group by
-- (user_id, user_book_id, local_date) and sum pages_read here — the UI
-- consumes the same shape either way.
-- ------------------------------------------------------------
create or replace function public.get_feed(uid uuid, lim int default 50)
returns table (
  log_id       uuid,
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  book_title   text,
  book_author  text,
  cover_url    text,
  pages_read   int,
  end_page     int,
  total_pages  int,
  note         text,
  logged_at    timestamptz,
  finished     boolean
)
language sql stable security definer set search_path = public as $$
  with cohort as (
    select uid as id
    union
    select friend_id from friend_ids(uid)
  )
  select
    l.id, p.id, p.username, p.display_name, p.avatar_url,
    b.title, b.author, b.cover_url,
    l.pages_read, l.end_page, b.total_pages, l.note, l.logged_at,
    (ub.status = 'finished'
      and ub.finished_at is not null
      and ub.finished_at >= l.logged_at
      and ub.finished_at < l.logged_at + interval '1 minute')
  from reading_logs l
  join cohort c        on c.id = l.user_id
  join profiles p      on p.id = l.user_id
  join user_books ub   on ub.id = l.user_book_id
  join books b         on b.id = ub.book_id
  order by l.logged_at desc
  limit lim;
$$;

-- ------------------------------------------------------------
-- Lifetime stats for the sidebar / profile header.
-- ------------------------------------------------------------
create or replace function public.get_stats(uid uuid)
returns table (
  total_pages    int,
  books_finished int,
  books_reading  int,
  pages_today    int
)
language sql stable security definer set search_path = public as $$
  select
    (select coalesce(sum(pages_read), 0)::int from reading_logs where user_id = uid),
    (select count(*)::int from user_books where user_id = uid and status = 'finished' and not archived),
    (select count(*)::int from user_books where user_id = uid and status = 'reading'  and not archived),
    (select coalesce(sum(pages_read), 0)::int from reading_logs
      where user_id = uid and local_date = current_local_date(uid));
$$;
