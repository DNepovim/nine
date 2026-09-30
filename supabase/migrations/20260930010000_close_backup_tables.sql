-- Takes the 23 September snapshots off the API surface.
--
-- Three tables — `backup_scores_20260923`, `backup_daily_scores_20260923` and
-- `backup_board_reigns_20260923` — were cut by hand in the SQL editor before the day's
-- rewrites of `scores` and `board_reigns` (`20260923010000_winnings.sql`,
-- `20260923020000_name_factors.sql`). Being hand-cut, they never came with the two
-- statements every table in this schema otherwise gets, and a `create table as select`
-- inherits neither the source table's RLS nor its grants: they landed in `public`
-- readable and writable by `anon`, which is the key that ships inside the app bundle.
-- Anyone who unzipped a build could read all 252 rows of player history out of them, or
-- delete them.
--
-- The snapshots themselves are worth keeping a while longer — they are the only copy of
-- what those boards held before the rewrite, and the live tables now hold fewer rows
-- than the backups do. So this closes them rather than dropping them: no client role
-- reaches them at all, and RLS goes on behind that as the belt to the braces, exactly as
-- `run_receipts` is held (`20260922010000_player_profile.sql`) — enabled with no policy,
-- which is how a table is said to be for the server alone.
--
-- ─── Why this is guarded ─────────────────────────────────────────────────────
--
-- Because the three tables are production and nowhere else. No migration created them,
-- so a fresh database — every `supabase db reset`, every contributor's local stack, and
-- whatever environment comes next — has never heard of them, and stating `revoke` on a
-- table that does not exist fails the whole file and takes the rest of the history down
-- with it. Skipping what is absent is the only form this can take while the tables live
-- outside the migration history.
--
-- Guarded twice over, in fact: it is also safe to run on a database that has already had
-- it, because the same SQL is applied to production ahead of this file reaching it —
-- production is behind the tree, and the hole should not stay open for the wait.
--
-- If the snapshots are ever dropped, this file becomes a no-op rather than a liability,
-- which is the other reason to write it this way.

do $$
declare
  t text;
begin
  foreach t in array array[
    'backup_scores_20260923',
    'backup_daily_scores_20260923',
    'backup_board_reigns_20260923'
  ] loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relname = t
    ) then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('alter table public.%I enable row level security', t);
    else
      raise notice 'close_backup_tables: public.% is not here, skipping', t;
    end if;
  end loop;
end $$;
