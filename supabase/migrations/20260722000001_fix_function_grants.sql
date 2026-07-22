-- Fixes partial apply of 001_init: functions and their grants were never created
-- because the grant statements incorrectly preceded the function definitions.

create or replace function leaderboard(
  p_mode       text,
  p_difficulty text,
  p_limit      int  default 5,
  p_since      date default null
) returns table (
  rank       bigint,
  user_id    uuid,
  nickname   text,
  best_score int,
  hits       int
) language sql stable security definer as $$
  select
    rank() over (order by s.best_score desc, s.updated_at asc)::bigint,
    s.user_id,
    p.nickname::text,
    s.best_score,
    s.hits
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

create or replace function my_rank(
  p_user_id    uuid,
  p_mode       text,
  p_difficulty text,
  p_since      date default null
) returns table (
  rank       bigint,
  total      bigint,
  best_score int,
  hits       int
) language sql stable security definer as $$
  with board as (
    select user_id, max(best_score) as best_score
    from (
      select user_id, best_score from scores
      where  mode = p_mode and difficulty = p_difficulty and p_since is null

      union all

      select user_id, max(best_score) as best_score
      from   daily_scores
      where  mode = p_mode and difficulty = p_difficulty
        and  p_since is not null and day >= p_since
      group  by user_id
    ) raw
    join profiles p on p.id = raw.user_id
    where p.nickname is not null
    group by user_id
  )
  select
    (select count(*) + 1 from board where best_score > coalesce((select best_score from board where user_id = p_user_id), -1))::bigint as rank,
    (select count(*) from board)::bigint as total,
    coalesce((select best_score from board where user_id = p_user_id), 0)::int as best_score,
    coalesce((select hits from scores where user_id = p_user_id and mode = p_mode and difficulty = p_difficulty), 0)::int as hits;
$$;

grant execute on function public.leaderboard(text, text, int, date) to anon, authenticated;
grant execute on function public.my_rank(uuid, text, text, date)    to anon, authenticated;
