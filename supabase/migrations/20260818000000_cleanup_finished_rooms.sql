-- Prunes rooms whose lifecycle already ended, on a schedule rather than at close time.
--
-- `finish_room` only ever flips a room's status to 'finished' (`20260723000001_
-- multiplayer.sql`) rather than deleting it — deleting there, from a client-callable
-- RPC, would let a single bad call cascade-delete a room's whole `room_players`
-- history in one shot. A finished room also isn't in anyone's way while it sits
-- there: `generate_room_code` already excludes non-waiting rooms from its uniqueness
-- check, so a stale finished row never blocks a fresh room from reusing its code.
--
-- What it does cost is table growth with nothing reading it back, so this retires
-- finished rows a week after the fact instead — long enough that nobody debugging a
-- session from the last few days loses it, short enough that the table stays a log of
-- recent play rather than an unbounded archive. `room_players` needs no matching
-- statement: its rows cascade with the room (`20260723000001_multiplayer.sql`).

create extension if not exists pg_cron with schema extensions;

create or replace function cleanup_finished_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rooms
  where status = 'finished'
    and created_at < now() - interval '7 days';
$$;

-- Postgres grants execute on new functions to `public` by default, which would put
-- this on the API surface as a callable RPC — the cron schedule below runs it as the
-- role that owns the job, so it needs no client-facing grant at all.
revoke execute on function cleanup_finished_rooms() from public;

select cron.schedule(
  'cleanup-finished-rooms',
  '0 3 * * *', -- daily, off the app's peak hours
  $$ select cleanup_finished_rooms(); $$
);
