-- Every place a player has taken on a session board, for the CHALLENGES list on their
-- profile.
--
-- `my_session_places` already answers this for the caller, but only as four counts and
-- only about themselves: an achievement asks "how many", never "which". A profile is
-- public and asks "which" about anybody whose name was tapped, so this is the list form —
-- one row per settled session the player finished in the top three.
--
-- Its own function rather than a new key on `player_profile`: that body carries the reign
-- stretches and the podium bounds and is copied whole every time it changes, and a list
-- that needs none of them is no reason to copy it again. The client reads both at once.
--
-- **Settled only** — shut and past the grace, the same bound the podium pays on and
-- `my_session_places` counts on. A place inside the grace can still move, and a profile
-- that showed silver and later bronze for the same session would be telling a medal's
-- story about something that is not one.
--
-- Ranked by `session_board` rather than ranked again here, so the place on the profile is
-- the place the summary printed, ties included. It also brings the nickname guard with
-- it: a player with no name is on no session board and so places nowhere.

create or replace function player_session_places(p_user_id uuid)
returns table (
  session_id uuid,
  mode_id    text,
  closes_at  timestamptz,
  measure    text,
  rank       int,
  best_score int,
  time_ms    int
) language sql stable security definer set search_path = public as $$
  select s.id, s.mode_id, s.closes_at, s.measure, b.rank::int, b.best_score, b.time_ms
  from   session_scores ss
  join   challenge_sessions s on s.id = ss.session_id
  cross join lateral (
    select x.rank, x.best_score, x.time_ms
    from   session_board(s.id) x
    where  x.user_id = p_user_id
  ) b
  where  ss.user_id = p_user_id
    and  now() >= s.closes_at + session_score_grace()
    and  b.rank <= 3
  order  by s.closes_at desc;
$$;

-- Both roles, as `player_profile` and `session_board` are: a profile is public data, and
-- a signed-out device tapping a name reads it the same as anybody.
grant execute on function public.player_session_places(uuid) to anon, authenticated;
