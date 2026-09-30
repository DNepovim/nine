-- Pins the search_path of the thirteen functions still resolving names against the
-- caller's.
--
-- A function that does not set `search_path` resolves every unqualified name — `scores`,
-- `rooms`, `now()` — against whatever path the session that called it happens to have.
-- For the ten `security definer` functions below that is the whole problem: they run with
-- their owner's rights, so a caller who puts a schema of their own in front of `public`
-- decides which `scores` table the owner's privileges are spent on, and a table or
-- operator planted there is executed as the owner. The three that are not definers
-- (`prevent_score_downgrade`, `stamp_feedback_answer`, `generate_room_code`) carry no
-- borrowed privilege, so the same shadowing only misleads them rather than arming them —
-- but they are pinned here too, because "which of these thirteen was safe" is not a
-- question worth leaving for a reader to answer.
--
-- Everything written since has set it inline at declaration (eleven functions do), which
-- is the right place for it. These thirteen predate the habit, and their bodies live in
-- migrations already applied to production.
--
-- ─── Why `alter function` and not thirteen `create or replace`s ──────────────
--
-- Restating a body to change one setting invites the body to drift from the migration
-- that owns it, and would put thirteen functions' worth of SQL in this file to say one
-- thing about each. `alter function` changes the setting and nothing else.
--
-- It also survives the gap this repo is in. Production sits four migrations behind the
-- tree, so a file carrying function bodies could not be applied ahead of them without
-- dragging unreleased work along; a file that carries no bodies can go on today, while
-- the hole is open, and apply again unchanged when the rest catches up. None of the
-- thirteen is touched by those four migrations, so the signatures below are the same
-- either side of them.
--
-- `search_path = public` and not `public, extensions`: none of the thirteen calls
-- anything outside `public` and `pg_catalog`, `citext` included — it is installed in
-- `public` here — and the eleven already pinned use exactly this value.
--
-- One thing to carry forward: `create or replace function` resets every attribute the new
-- declaration does not restate, so a later rewrite of any function below must spell
-- `set search_path = public` out itself. It will not be inherited from here.

-- ─── Triggers ────────────────────────────────────────────────────────────────
alter function public.prevent_score_downgrade() set search_path = public;
alter function public.stamp_feedback_answer()   set search_path = public;

-- ─── Multiplayer ─────────────────────────────────────────────────────────────
alter function public.create_room(p_mode text)        set search_path = public;
alter function public.join_room(p_code text)          set search_path = public;
alter function public.start_room(p_room_id uuid)      set search_path = public;
alter function public.finish_room(p_room_id uuid)     set search_path = public;
alter function public.generate_room_code()            set search_path = public;

-- ─── Boards, medals and factors ──────────────────────────────────────────────
alter function public.leaderboard(p_mode text, p_difficulty text, p_limit int, p_since date)
  set search_path = public;
alter function public.my_rank(p_user_id uuid, p_mode text, p_difficulty text, p_since date)
  set search_path = public;
alter function public.my_medals(p_user_id uuid, p_today date, p_week_since date)
  set search_path = public;
alter function public.past_winners(
  p_mode text, p_difficulty text, p_yesterday date, p_week_from date, p_week_to date
) set search_path = public;
alter function public.player_factors(p_user uuid)      set search_path = public;
alter function public.players_factors(p_users uuid[])  set search_path = public;
