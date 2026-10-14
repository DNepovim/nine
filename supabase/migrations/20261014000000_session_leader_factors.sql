-- The leader's own colours on the intro banner.
--
-- A nickname the app writes on its own surface is drawn in the gradient that player's
-- lifetime averages earn them — see `GradientName`, and `lib/name-gradient.ts` for the
-- arithmetic. The banner was the one place writing a name without them, so the leader of
-- a challenge was the only player in the app whose name came out in flat ink.
--
-- `session_board` already computes this per row, from `player_factors`. All this does is
-- carry the same two figures for the one row the card actually draws, which is cheaper
-- than the alternative: the card had no user id either, so colouring the name without
-- this would have meant a second round trip per launch to look up a single player.
--
-- Dropped and recreated rather than replaced: `create or replace function` cannot widen a
-- `returns table`, and the grant goes with the drop — hence the regrant at the foot.

drop function if exists open_sessions_with_leaders();

create or replace function open_sessions_with_leaders()
returns table (
  id            uuid,
  mode_id       text,
  opens_at      timestamptz,
  closes_at     timestamptz,
  leader_name   text,
  leader_score  int,
  leader_acc    int,
  leader_spd    int
) language sql stable security definer set search_path = public as $$
  select
    s.id, s.mode_id, s.opens_at, s.closes_at,
    lead_row.nickname::text,
    lead_row.best_score,
    lead_row.avg_acc,
    lead_row.avg_spd
  from challenge_sessions s
  left join lateral (
    select p.nickname, b.best_score, f.avg_acc, f.avg_spd
    from session_scores b
    join profiles p on p.id = b.user_id
    -- `left join` for the reason `session_board` uses one: a player the counters have
    -- never seen still leads the session, with their name simply drawn uncoloured.
    left join lateral player_factors(b.user_id) f on true
    where b.session_id = s.id and p.nickname is not null
    order by b.best_score desc, b.updated_at asc
    limit 1
  ) lead_row on true
  where s.closes_at > now()
  order by s.opens_at asc;
$$;

grant execute on function public.open_sessions_with_leaders() to anon, authenticated;
