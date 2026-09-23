-- A player's name is now drawn in a gradient their own play earns: the front of it in
-- Accuracy's hue, the back in Speed's, each end keeping only as much colour as their
-- lifetime average in that factor. See lib/name-gradient.ts for the colour itself.
--
-- The profile modal could already do this — `player_profile` returns the per-board sums
-- and the client averages them. Nowhere else could: `leaderboard` and `past_winners`
-- return a nickname and a score, so every name outside the modal had nothing to colour
-- itself with. This migration gives both of them the two averages.
--
-- Both are `returns table` functions, and Postgres will not let `create or replace`
-- change a return type. So both are dropped and recreated, and both grants are
-- re-applied — the drop takes them with it.

-- ─── The averages themselves ─────────────────────────────────────────────────
-- One player's lifetime factor averages, over every board they have played.
--
-- Its own function rather than a join written out twice, so the two callers below cannot
-- come to disagree about what a career average is. It is the same arithmetic
-- `averagePercent` does on the client — round(100 * sum / hits) — because two ways of
-- computing one number is how the two come to differ by a point.
--
-- Null, not zero, where nothing has been counted: `sum()` over no rows is null, so the
-- comparison is null, so the case falls through. The client reads that as 0% — a player
-- who has shown the boards nothing is drawn the same as one who has played badly — but
-- that reading belongs to the client, and the database says only that it does not know.
--
-- Both factors are summed over every board rather than over their own mode's boards.
-- Every hit carries both, in either mode, which is what makes them a fact about the
-- player rather than about the mode they happened to pick.
create or replace function player_factors(p_user uuid)
returns table (avg_acc int, avg_spd int)
language sql stable security definer as $$
  select
    case when sum(t.hits) > 0
         then round(100 * sum(t.acc_sum) / sum(t.hits))::int end,
    case when sum(t.hits) > 0
         then round(100 * sum(t.spd_sum) / sum(t.hits))::int end
  from player_totals t
  where t.user_id = p_user;
$$;

-- Granted like every other read here. `player_totals` is already `grant select ... to
-- anon` behind a `using (true)` policy, and `player_profile` already returns these same
-- sums for any player, so this exposes nothing that was not public.
grant execute on function public.player_factors(uuid) to anon, authenticated;

-- The same answer for a handful of players at once.
--
-- Three callers need factors for players no board row carries: the player's own row when
-- it sits below the board's cut, the intro screen's greeting, and a multiplayer room,
-- whose tiles come from `room_players` and presence rather than from a leaderboard. One
-- request for the lot rather than one per name.
--
-- `left join lateral` so every id asked about comes back, including one with no counters
-- behind it. A caller matching a response to a name needs the row to exist before it can
-- read null out of it; silently returning fewer rows than were asked for is how a name
-- ends up uncoloured for the wrong reason.
create or replace function players_factors(p_users uuid[])
returns table (user_id uuid, avg_acc int, avg_spd int)
language sql stable security definer as $$
  select u.id, f.avg_acc, f.avg_spd
  from   unnest(p_users) as u(id)
  left join lateral player_factors(u.id) f on true;
$$;

grant execute on function public.players_factors(uuid[]) to anon, authenticated;

-- ─── The board ───────────────────────────────────────────────────────────────
-- Unchanged but for the two columns and the lateral that fills them. The body is
-- otherwise exactly as `20260922040000_leaderboard_window_pick.sql` left it, including
-- the wrapper around the `distinct on` that fixed THIS WEEK showing a player's older day.
drop function if exists public.leaderboard(text, text, int, date);

create function leaderboard(
  p_mode       text,
  p_difficulty text,
  p_limit      int  default 5,
  p_since      date default null
) returns table (
  rank        bigint,
  user_id     uuid,
  nickname    text,
  best_score  int,
  hits        int,
  achieved_at timestamptz,
  avg_acc     int,
  avg_spd     int
) language sql stable security definer as $$
  select
    rank() over (order by s.best_score desc, s.updated_at asc)::bigint,
    s.user_id,
    p.nickname::text,
    s.best_score,
    s.hits,
    s.updated_at,
    f.avg_acc,
    f.avg_spd
  from (
    select user_id, best_score, hits, updated_at
    from   scores
    where  mode = p_mode and difficulty = p_difficulty and p_since is null

    union all

    -- Wrapped so the `order by` below is this select's and not the union's. Without the
    -- wrapper the branch has no ordering, and `distinct on` keeps an arbitrary day.
    select user_id, best_score, hits, updated_at
    from (
      select distinct on (user_id) user_id, best_score, hits, updated_at
      from   daily_scores
      where  mode = p_mode and difficulty = p_difficulty
        and  p_since is not null and day >= p_since
      order  by user_id, best_score desc, updated_at asc
    ) best_day
  ) s
  join profiles p on p.id = s.user_id
  -- `left join` so a player the counters have never seen still appears on the board.
  -- Their record is real and predates `player_totals`; an inner join would quietly drop
  -- them off the leaderboard to give their name a colour, which is the wrong trade.
  left join lateral player_factors(s.user_id) f on true
  where p.nickname is not null
  order by s.best_score desc, s.updated_at asc
  limit p_limit;
$$;

grant execute on function public.leaderboard(text, text, int, date) to anon, authenticated;

-- ─── The winners stripe ──────────────────────────────────────────────────────
-- Same two columns, same reasoning. Body otherwise as
-- `20260921000000_past_winners.sql` left it.
drop function if exists public.past_winners(text, text, date, date, date);

create function past_winners(
  p_mode       text,
  p_difficulty text,
  p_yesterday  date,
  p_week_from  date,
  p_week_to    date
) returns table (
  period     text,
  user_id    uuid,
  nickname   text,
  best_score int,
  avg_acc    int,
  avg_spd    int
) language sql stable security definer as $$
  with windows (period, from_day, to_day) as (
    values ('yesterday'::text, p_yesterday, p_yesterday),
           ('last_week',       p_week_from, p_week_to)
  )
  select w.period, top.user_id, top.nickname, top.best_score, f.avg_acc, f.avg_spd
  from windows w
  -- One row per window, or none where nobody played it — a window with no winner
  -- drops out here rather than coming back as a null the client has to read around.
  join lateral (
    select d.user_id, pr.nickname::text as nickname, d.best_score
    from   daily_scores d
    -- A player without a nickname is not on the board at all, so they cannot have won
    -- it either. Same rule as `leaderboard` and `my_medals`.
    join   profiles pr on pr.id = d.user_id and pr.nickname is not null
    where  d.mode = p_mode
      and  d.difficulty = p_difficulty
      and  d.day between w.from_day and w.to_day
      -- A zero is not a result. The first submit on a board writes a row regardless,
      -- and an empty window would otherwise crown whoever touched it last.
      and  d.best_score > 0
    -- Ties go to whoever reached the score first, which is how every board in the app
    -- breaks them.
    order  by d.best_score desc, d.updated_at asc
    limit  1
  ) top on true
  -- Left, for the same reason the board's is: a winner from before the counters existed
  -- keeps their stripe and is simply drawn uncoloured.
  left join lateral player_factors(top.user_id) f on true;
$$;

grant execute on function public.past_winners(text, text, date, date, date) to anon, authenticated;
