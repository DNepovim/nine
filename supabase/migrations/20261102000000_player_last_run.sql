-- When a player last played, for the line under their name on the profile.
--
-- Off `run_receipts`, which is the one table every run writes to — a board run through
-- `record_run`, a challenge run through `record_session_run` — and which is never pruned.
-- `player_totals.updated_at` would miss every challenge run, and `scores.updated_at` moves
-- only when a best does.
--
-- Its own function rather than a new key on `player_profile`, for the reason
-- `player_session_places` gave: that body is copied whole every time it changes, and one
-- timestamp is no reason to copy it again. The client reads all three at once.
--
-- Gated on the nickname like the rest of the profile: a player with no name is on no
-- board and has no profile for this to appear on.

-- `run_receipts_at_idx` is on `at` alone, which answers "this week" for the analytics but
-- not "this player's latest". With the user leading, the max is one index probe.
create index if not exists run_receipts_user_at_idx on run_receipts (user_id, at desc);

create or replace function player_last_run(p_user_id uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(r.at)
  from   run_receipts r
  where  r.user_id = p_user_id
    and  exists (
           select 1 from profiles p where p.id = p_user_id and p.nickname is not null
         );
$$;

-- Both roles, as `player_profile` is: a profile is public data, and a signed-out device
-- tapping a name reads it the same as anybody.
grant execute on function public.player_last_run(uuid) to anon, authenticated;
