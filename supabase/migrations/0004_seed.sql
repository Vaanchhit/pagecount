-- ============================================================
-- 0004_seed.sql — badge catalogue + new-user bootstrap
-- ============================================================

insert into public.badges (key, name, description, kind, threshold, tier) values
  -- streak
  ('streak_3',    'Three in a row',   'Read three days running',        'streak',     3,  1),
  ('streak_5',    'Five days',        'Five consecutive days',          'streak',     5,  2),
  ('streak_7',    'A full week',      'Seven consecutive days',         'streak',     7,  3),
  ('streak_15',   'Fortnight',        'Fifteen consecutive days',       'streak',    15,  4),
  ('streak_30',   'A month of it',    'Thirty consecutive days',        'streak',    30,  5),
  ('streak_50',   'Fifty',            'Fifty consecutive days',         'streak',    50,  6),
  ('streak_100',  'Century streak',   'One hundred consecutive days',   'streak',   100,  7),
  ('streak_365',  'Every single day', 'A full year without a gap',      'streak',   365,  8),
  -- pages
  ('pages_100',   'First hundred',    'One hundred pages logged',       'pages',    100,  1),
  ('pages_500',   'Five hundred',     'Five hundred pages logged',      'pages',    500,  2),
  ('pages_1000',  'One thousand',     'A thousand pages logged',        'pages',   1000,  3),
  ('pages_5000',  'Five thousand',    'Five thousand pages logged',     'pages',   5000,  4),
  ('pages_10000', 'Ten thousand',     'Ten thousand pages logged',      'pages',  10000,  5),
  ('pages_50000', 'Fifty thousand',   'Fifty thousand pages logged',    'pages',  50000,  6),
  -- books
  ('books_1',     'Finished one',     'Finished your first book',       'books',      1,  1),
  ('books_5',     'Five books',       'Finished five books',            'books',      5,  2),
  ('books_10',    'Ten books',        'Finished ten books',             'books',     10,  3),
  ('books_25',    'Twenty-five',      'Finished twenty-five books',     'books',     25,  4),
  ('books_50',    'Fifty books',      'Finished fifty books',           'books',     50,  5),
  ('books_100',   'A hundred books',  'Finished one hundred books',     'books',    100,  6)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Create a profile row the moment a user signs up. Username is provisional
-- and gets replaced during onboarding; it just has to be unique and legal.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'reader'; end if;
  base := left(base, 16);
  candidate := base;

  while exists (select 1 from profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 16) || n::text;
  end loop;

  insert into profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'full_name', candidate));

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
