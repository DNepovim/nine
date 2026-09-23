-- THIS WEEK showed a player's older day instead of their best one.
--
-- `20260920000000_leaderboard_record_row.sql` replaced a column-wise rollup with
-- `distinct on (user_id)` so that a windowed row is one real run, ties going to the
-- earlier one. The intent was right and the ordering it needs was written — but it was
-- written at the end of a `union all`, where it belongs to the union rather than to the
-- branch:
--
--   select user_id, ... from scores where p_since is null
--   union all
--   select distinct on (user_id) user_id, ... from daily_scores where day >= p_since
--   order by user_id, best_score desc, updated_at asc   -- the UNION's, not the branch's
--
-- A `distinct on` with no `order by` of its own keeps whichever row Postgres reaches
-- first, which is unpredictable and in practice was the earliest day in the window. So a
-- player with two days on the board was ranked by whichever of them came out of the
-- table first, not by their best.
--
-- Only THIS WEEK could show it. TODAY reads the same table through the same branch, but
-- its window is a single day and `daily_scores` holds one row per player per day, so
-- there is never anything to choose between; EVER reads `scores`, where the best is the
-- only row there is. That is why two of the three boards agreed and one did not —
-- and why the one that did not also disagreed with `my_rank`, which aggregates the
-- window with `max(best_score)` and was right all along.
--
-- Seen in production: an all-time record of 21313 set today took TODAY and EVER, while
-- THIS WEEK went on showing the same player's 20832 from yesterday.
--
-- The fix is to give the `distinct on` a select of its own to order. The union's own
-- trailing `order by` is dropped rather than moved: the outer query re-sorts by score
-- for the ranking anyway, so it never did anything but mislead.
--
-- OUT columns and signature are unchanged, so this replaces in place and keeps its grant.

create or replace function leaderboard(
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
  achieved_at timestamptz
) language sql stable security definer as $$
  select
    rank() over (order by s.best_score desc, s.updated_at asc)::bigint,
    s.user_id,
    p.nickname::text,
    s.best_score,
    s.hits,
    s.updated_at
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
  where p.nickname is not null
  order by s.best_score desc, s.updated_at asc
  limit p_limit;
$$;
