-- ============================================================
-- 0001_schema.sql — tables, types, indexes
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------- profiles ----------
create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  username        text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name    text,
  avatar_url      text,
  -- IANA timezone. Every streak / grid query keys off this, never off UTC.
  timezone        text not null default 'Asia/Kolkata',
  daily_page_goal int  not null default 20 check (daily_page_goal between 1 and 2000),
  -- False until the user picks a username and we capture their real timezone.
  -- Until then the app routes them to /onboarding.
  onboarded       boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------- books (global, deduped) ----------
create table public.books (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'openlibrary',
  source_id   text not null,               -- e.g. '/works/OL45804W'
  isbn13      text,
  title       text not null,
  author      text,
  cover_url   text,
  total_pages int check (total_pages > 0),
  created_at  timestamptz not null default now(),
  unique (source, source_id)
);

create index books_title_trgm on public.books using gin (title gin_trgm_ops);

-- ---------- shelves ----------
create type public.shelf_status as enum ('reading', 'finished', 'want_to_read');

create table public.user_books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid not null references public.books(id)    on delete cascade,
  status      public.shelf_status not null default 'reading',
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  -- Soft delete. Hard-deleting a shelf entry would take its reading_logs with
  -- it and silently punch a hole in the user's streak history.
  archived    boolean not null default false,
  unique (user_id, book_id)
);

create index user_books_user_status on public.user_books (user_id, status) where archived = false;

-- ---------- reading logs ----------
create table public.reading_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id)   on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  pages_read   int  not null check (pages_read > 0),   -- delta
  end_page     int  check (end_page > 0),              -- position in the book
  note         text check (char_length(note) <= 500),
  -- Date in the *user's* timezone, written at insert. Do not derive from
  -- logged_at at read time: a 00:40 IST log is 19:10 UTC the previous day.
  local_date   date not null,
  logged_at    timestamptz not null default now()
);

create index reading_logs_user_date  on public.reading_logs (user_id, local_date desc);
create index reading_logs_book_time  on public.reading_logs (user_book_id, logged_at desc);

-- ---------- friendships (mutual, request + accept) ----------
create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- One row per pair regardless of who asked first, so A->B and B->A collide.
create unique index friendships_pair_uniq on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index friendships_addressee on public.friendships (addressee_id, status);
create index friendships_requester on public.friendships (requester_id, status);

-- ---------- streak freezes ----------
-- One auto-applied freeze per calendar month. The unique constraint on
-- (user_id, month_key) is what enforces "one per month" — not app logic.
create table public.streak_freezes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  used_on   date not null,
  month_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, month_key),
  unique (user_id, used_on)
);

-- ---------- badges ----------
-- Catalogue table rather than hardcoded constants: adding a 200-day tier
-- later is an INSERT, not a deploy.
create table public.badges (
  key         text primary key,
  name        text not null,
  description text not null,
  kind        text not null check (kind in ('streak', 'pages', 'books')),
  threshold   int  not null,
  tier        int  not null
);

create table public.user_badges (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null references public.badges(key)  on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create index user_badges_recent on public.user_badges (user_id, earned_at desc);
