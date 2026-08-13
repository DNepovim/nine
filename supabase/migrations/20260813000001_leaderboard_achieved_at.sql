-- The board says when each record was set, so a row can show how long it has stood.
--
-- No new column is needed: `scores` and `daily_scores` have carried `updated_at` since
-- the schema was written, and `leaderboard` already reads it — it ranks ties by it. It
-- simply never handed it back.
--
-- Dropped rather than replaced. Postgres refuses to change a function's OUT columns
-- with `create or replace`, so the whole body is restated here unchanged apart from the
-- extra select item, and the grant is reapplied because dropping takes it with it.

drop function if exists leaderboard(text, text, int, date);

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

    select
      user_id,
      max(best_score)                                           as best_score,
      (array_agg(hits order by best_score desc))[1]            as hits,
      max(updated_at)                                           as updated_at
    from   daily_scores
    where  mode = p_mode and difficulty = p_difficulty
      and  p_since is not null and day >= p_since
    group  by user_id
  ) s
  join profiles p on p.id = s.user_id
  where p.nickname is not null
  order by s.best_score desc, s.updated_at asc
  limit p_limit;
$$;

grant execute on function public.leaderboard(text, text, int, date) to anon, authenticated;
