-- Every podium finish a player holds, across all six boards and all three periods,
-- in one round trip.
--
-- The medal line under the title needs 6 boards × 3 periods = 18 standings. Asking
-- `my_rank` for each is 18 round trips on the intro screen for a decorative line, so
-- this generalises that function over the whole cross product and returns only the
-- rows belonging to one player — at most 18, usually one or two.
--
-- The period boundaries are passed in rather than computed here: the app draws them
-- on the Prague clock (see lib/leaderboard-period.ts), and a second definition in SQL
-- is a second thing to keep in step. One definition, in TypeScript, already tested.

create or replace function my_medals(
  p_user_id    uuid,
  p_today      date,
  p_week_since date
) returns table (
  mode       text,
  difficulty text,
  period     text,
  rank       bigint,
  best_score int
) language sql stable security definer as $$
  with periods (period, since) as (
    values ('today'::text, p_today), ('week', p_week_since), ('ever', null::date)
  ),
  -- Every published player's best on every board, once per period. Mirrors the board
  -- CTE in `my_rank`: all-time reads `scores`, a bounded period rolls up `daily_scores`,
  -- and a player without a nickname is not on the board at all.
  board as (
    select
      p.period,
      s.mode,
      s.difficulty,
      s.user_id,
      max(s.best_score) as best_score
    from periods p
    join lateral (
      select user_id, mode, difficulty, best_score
      from   scores
      where  p.since is null

      union all

      select user_id, mode, difficulty, best_score
      from   daily_scores
      where  p.since is not null and day >= p.since
    ) s on true
    join profiles pr on pr.id = s.user_id and pr.nickname is not null
    group by p.period, s.mode, s.difficulty, s.user_id
  )
  select
    b.mode,
    b.difficulty,
    b.period,
    (
      select count(*) + 1
      from   board o
      where  o.period = b.period
        and  o.mode = b.mode
        and  o.difficulty = b.difficulty
        and  o.best_score > b.best_score
    )::bigint as rank,
    b.best_score
  -- A zero is not a standing: `scores` carries a row from the first submit, and a
  -- player who has never posted would otherwise rank first on an empty board.
  from board b
  where b.user_id = p_user_id and b.best_score > 0;
$$;

grant execute on function public.my_medals(uuid, date, date) to anon, authenticated;
