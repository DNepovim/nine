-- A windowed board row must be one real run, not columns from several.
--
-- `leaderboard` reads `scores` for the all-time board and rolls up `daily_scores` for
-- TODAY and THIS WEEK. That rollup aggregated each column on its own:
--
--   max(best_score), (array_agg(hits order by best_score desc))[1], max(updated_at)
--
-- `hits` was already taken from the best-scoring day, but `updated_at` was the latest
-- day the player appeared in the window — a different row whenever the record is not
-- also the most recent run. The board then glued the two together and reported a
-- record that had stood for days as minutes old, disagreeing with the all-time board
-- about the same score. Seen in production: a 20478 set on the 19th shown on THIS WEEK
-- with the timestamp of that player's 1976 the following afternoon, while EVER — which
-- reads `scores`, where the timestamp travels with the score — correctly said 22 hours.
--
-- It also fed the tiebreak. `order by best_score desc, updated_at asc` is meant to give
-- a tied rank to whoever got there first; on a windowed board it was ranking by who had
-- played most recently, which is the opposite.
--
-- `distinct on` takes the whole winning row instead, ties going to the earlier run —
-- the same pick the rollup trigger's backfill makes, so the two tables agree by
-- construction rather than by coincidence.
--
-- OUT columns are unchanged, so this replaces in place and keeps its grant.

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

    select distinct on (user_id) user_id, best_score, hits, updated_at
    from   daily_scores
    where  mode = p_mode and difficulty = p_difficulty
      and  p_since is not null and day >= p_since
    order  by user_id, best_score desc, updated_at asc
  ) s
  join profiles p on p.id = s.user_id
  where p.nickname is not null
  order by s.best_score desc, s.updated_at asc
  limit p_limit;
$$;
