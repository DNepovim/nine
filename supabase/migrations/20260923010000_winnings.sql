-- Winnings — what taking a board's day or week pays.
--
-- Nothing is stored. `daily_scores` already holds every fact an award depends on, and a
-- closed day never changes: the client stamps `day` from the Prague clock at submit time
-- and no path writes to a past day. So the whole figure is a function of a table that is
-- already here — no nightly job that must never run twice, no backfill, and no second
-- number that can drift from the boards it came from. Every day anyone ever won counts
-- from this migration forward, including all of history.
--
-- Neither function below knows what a difficulty is worth. They return the raw winning
-- scores and the app applies `scoreWeight` from machines/modes.ts. A `case difficulty
-- when 'easy' then 0.5` here would be a second definition of the app's difficulty
-- weighting, in a second language, with nothing to keep the two in step.
--
-- See docs/superpowers/specs/2026-09-23-winnings-design.md.

-- ─── Index ───────────────────────────────────────────────────────────────────
-- `daily_scores` has only its primary key, which leads on the player and so cannot serve
-- a query that groups by board and day across everyone. `past_winners` runs this same
-- shape over two windows and has managed without; winnings run it over all history.

create index if not exists daily_scores_board_day_idx
  on daily_scores (mode, difficulty, day, best_score desc, updated_at asc);

-- ─── Who won what ────────────────────────────────────────────────────────────
-- Every window this player took that closed in [p_from_day, p_today).
--
-- The winner rule is the one `past_winners` already encodes, for the same reasons: the
-- highest score in the window, ties to whoever reached it first, no zeros — the first
-- submit on a board writes a row regardless and an empty window would otherwise pay
-- whoever touched it last — and no nickname, no board, so no win.
--
-- Bounds are passed in rather than computed here, exactly as `past_winners` and
-- `my_medals` take theirs: the app draws them on the Prague clock, and a second
-- definition in SQL is a second thing to keep in step.

create or replace function my_winnings(
  p_user_id  uuid,
  -- First day not yet announced, inclusive. The caller holds the last day already
  -- announced and passes the day after it.
  p_from_day date,
  -- Today on the Prague clock. Exclusive: today's own day has not closed, so it cannot
  -- have been won.
  p_today    date
) returns table (
  period     text,
  mode       text,
  difficulty text,
  -- The day won, or the Monday of the week won.
  won_on     date,
  best_score int
) language sql stable security definer set search_path = public as $$
  with day_winners as (
    select distinct on (d.mode, d.difficulty, d.day)
           d.mode, d.difficulty, d.day, d.user_id, d.best_score
    from   daily_scores d
    join   profiles pr on pr.id = d.user_id and pr.nickname is not null
    where  d.day >= p_from_day and d.day < p_today and d.best_score > 0
    order  by d.mode, d.difficulty, d.day, d.best_score desc, d.updated_at asc
  ),
  -- The Mondays of every week that closed inside the span. `date_trunc('week', ...)` is
  -- Monday in Postgres, which is what `weekStart` in lib/leaderboard-period.ts means too.
  --
  -- Starting at the marker's own Monday is deliberate: a marker of Wednesday means that
  -- week had not closed when it was set, so the week is still owed. A week that closed
  -- before the marker has an earlier Monday and falls outside the series. When nothing
  -- has closed the series is empty rather than wrong.
  weeks as (
    select generate_series(
             date_trunc('week', p_from_day::timestamp)::date,
             date_trunc('week', p_today::timestamp)::date - 7,
             interval '7 days'
           )::date as from_day
  ),
  week_winners as (
    select w.from_day, top.mode, top.difficulty, top.user_id, top.best_score
    from   weeks w
    -- A period board ranks each player's best day in the window, so the top single day
    -- in the week belongs to whoever leads it. No aggregation needed to find it.
    cross join lateral (
      select distinct on (d.mode, d.difficulty)
             d.mode, d.difficulty, d.user_id, d.best_score
      from   daily_scores d
      join   profiles pr on pr.id = d.user_id and pr.nickname is not null
      where  d.day between w.from_day and w.from_day + 6 and d.best_score > 0
      order  by d.mode, d.difficulty, d.best_score desc, d.updated_at asc
    ) top
  )
  select 'day'::text, w.mode, w.difficulty, w.day, w.best_score
  from   day_winners w where w.user_id = p_user_id
  union all
  select 'week'::text, w.mode, w.difficulty, w.from_day, w.best_score
  from   week_winners w where w.user_id = p_user_id;
$$;

grant execute on function public.my_winnings(uuid, date, date) to anon, authenticated;

-- ─── The profile's running total ─────────────────────────────────────────────
-- `player_profile` gains one key: the winning scores this player has taken on each board,
-- summed over all history and split by window so the app can weight each half.
--
-- Built on `my_winnings` rather than repeating its query, so "who won a board" has one
-- definition. The span starts at the first day the table holds rather than at some fixed
-- epoch — a `generate_series` from 1970 would build three thousand empty weeks to find
-- the handful that have anything in them.

create or replace function player_profile(
  p_user_id    uuid,
  p_today      date,
  p_week_since date
) returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nickname', (
      select p.nickname::text from profiles p
      where  p.id = p_user_id and p.nickname is not null
    ),
    'totals', coalesce((
      select json_agg(json_build_object(
        'mode', t.mode, 'difficulty', t.difficulty,
        'runs', t.runs, 'hits', t.hits, 'scoreSum', t.score_sum,
        'accSum', t.acc_sum, 'spdSum', t.spd_sum
      ) order by t.mode, t.difficulty)
      from player_totals t where t.user_id = p_user_id
    ), '[]'::json),
    -- A zero is not a result: `scores` carries a row from the first submit, the same
    -- reason `my_medals` and `past_winners` both filter it out.
    'bests', coalesce((
      select json_agg(json_build_object(
        'mode', s.mode, 'difficulty', s.difficulty,
        'bestScore', s.best_score, 'hits', s.hits, 'achievedAt', s.updated_at
      ) order by s.mode, s.difficulty)
      from scores s where s.user_id = p_user_id and s.best_score > 0
    ), '[]'::json),
    'medals', coalesce((
      select json_agg(json_build_object(
        'mode', m.mode, 'difficulty', m.difficulty, 'period', m.period,
        'rank', m.rank, 'bestScore', m.best_score
      ))
      from my_medals(p_user_id, p_today, p_week_since) m
    ), '[]'::json),
    'reigns', coalesce((
      select json_agg(json_build_object(
        'mode', r.mode, 'difficulty', r.difficulty, 'score', r.score,
        'tookAt', r.took_at, 'lostAt', r.lost_at
      ) order by r.took_at desc)
      from board_reigns r where r.user_id = p_user_id
    ), '[]'::json),
    'winnings', coalesce((
      select json_agg(json_build_object(
        'mode', w.mode, 'difficulty', w.difficulty,
        'daySum', w.day_sum, 'weekSum', w.week_sum
      ) order by w.mode, w.difficulty)
      from (
        select m.mode, m.difficulty,
               coalesce(sum(m.best_score) filter (where m.period = 'day'), 0)  as day_sum,
               coalesce(sum(m.best_score) filter (where m.period = 'week'), 0) as week_sum
        from   my_winnings(
                 p_user_id,
                 coalesce((select min(d.day) from daily_scores d), p_today),
                 p_today
               ) m
        group  by m.mode, m.difficulty
      ) w
    ), '[]'::json)
  );
$$;

-- Unchanged signature, so the existing grant still stands. Restated because a
-- `create or replace` that ever changes the argument list would silently leave the old
-- function — and its grant — in place beside the new one.
grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;
