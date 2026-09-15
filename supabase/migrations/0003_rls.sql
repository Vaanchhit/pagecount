-- ============================================================
-- 0003_rls.sql
--
-- Every table is locked by default. The visibility rule throughout is
-- "mine, or an accepted friend's" — written once here rather than
-- re-implemented in each query, so a forgotten WHERE clause in the app
-- can't leak anything.
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.books          enable row level security;
alter table public.user_books     enable row level security;
alter table public.reading_logs   enable row level security;
alter table public.friendships    enable row level security;
alter table public.streak_freezes enable row level security;
alter table public.badges         enable row level security;
alter table public.user_badges    enable row level security;

-- ---------- profiles ----------
-- Readable by any signed-in user: you can't send a friend request to
-- someone you can't find. Only username / display name / avatar are
-- exposed anywhere in the UI.
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated using (true);

create policy "profiles insert own"
  on public.profiles for insert
  to authenticated with check (id = auth.uid());

create policy "profiles update own"
  on public.profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- books ----------
-- Global catalogue, populated from Open Library on first use.
create policy "books readable by authenticated"
  on public.books for select
  to authenticated using (true);

create policy "books insertable by authenticated"
  on public.books for insert
  to authenticated with check (true);

create policy "books updatable by authenticated"
  on public.books for update
  to authenticated using (true) with check (true);

-- ---------- user_books ----------
create policy "shelf visible to self and friends"
  on public.user_books for select
  to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

create policy "shelf insert own"
  on public.user_books for insert
  to authenticated with check (user_id = auth.uid());

create policy "shelf update own"
  on public.user_books for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deliberately no DELETE policy. Removing a book is an archive, never a
-- delete, because the logs underneath it are streak history.

-- ---------- reading_logs ----------
create policy "logs visible to self and friends"
  on public.reading_logs for select
  to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

create policy "logs insert own"
  on public.reading_logs for insert
  to authenticated with check (user_id = auth.uid());

create policy "logs update own"
  on public.reading_logs for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "logs delete own"
  on public.reading_logs for delete
  to authenticated using (user_id = auth.uid());

-- ---------- friendships ----------
create policy "friendships visible to both parties"
  on public.friendships for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "friendships request as self"
  on public.friendships for insert
  to authenticated with check (requester_id = auth.uid());

-- Only the addressee can accept. Without the USING/WITH CHECK pair a
-- requester could flip their own request to 'accepted'.
create policy "friendships accept as addressee"
  on public.friendships for update
  to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid());

create policy "friendships remove by either party"
  on public.friendships for delete
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ---------- streak_freezes ----------
-- Read-only to the owner. Written exclusively by the security-definer
-- trigger, so nobody can mint themselves freezes.
create policy "freezes visible to self and friends"
  on public.streak_freezes for select
  to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

-- ---------- badges ----------
create policy "badge catalogue is public"
  on public.badges for select
  to authenticated using (true);

create policy "earned badges visible to self and friends"
  on public.user_badges for select
  to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

-- No insert policy on user_badges either: awarding happens in
-- evaluate_badges(), which is security definer.
