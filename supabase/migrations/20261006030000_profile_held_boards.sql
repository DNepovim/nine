-- Every board this player has held, not just the all-time ones.
--
-- `board_reigns` is all-time only, on purpose: TODAY and THIS WEEK change hands daily,
-- and a stored row per day would be a table growing by six rows a day to say something
-- nobody reads one day at a time. That argument still holds for *storing* them. It never
-- held for *showing* them — a player who took Easy Accuracy's day is owed the fact, and
-- the profile had nowhere to put it.
--
-- So this is derived, the way winnings are and for the same reasons (see
-- …_winnings.sql): `daily_scores` already holds every fact involved, a closed day never
-- changes, and `my_winnings` already encodes the one definition of who won a board. No
-- new table, no nightly job, no backfill — and all of history counts, including the days
-- that closed before anybody thought to show them.
--
-- The one thing added on top is the collapse. A player who took a board every day for
-- three weeks held that board for three weeks; twenty-one rows saying so is noise, and
-- one row spanning them is the fact. That is also the only reason a day board can appear
-- on this list at all.

-- ─── Reading a profile ───────────────────────────────────────────────────────
-- Restated in full from …_profile_best_factors.sql, which says why: this function is
-- built with `create or replace`, so every migration that touches it has to carry
-- forward everything the ones before it added — `motto`, `achievements`, the totals'
-- `bestAcc`/`bestSpd`/`timeMs`, and `winnings`. The `wins` key is the only change.
-- Whoever restates it next: start from *this* definition.

create or replace function player_profile(
  p_user_id    uuid,
  p_today      date,
  p_week_since date
) returns json language sql stable security definer set search_path = public as $$
  with
  -- Every window this player ever took, one row each, with the step that makes two of
  -- them adjacent. A day board's next window is tomorrow; a week board's is seven days
  -- on, because `my_winnings` dates a week by its Monday.
  won as (
    select m.period, m.mode, m.difficulty, m.won_on,
           case when m.period = 'day' then 1 else 7 end as step
    from   my_winnings(
             p_user_id,
             -- The first day the table holds rather than a fixed epoch, exactly as the
             -- `winnings` key below does it: a series from 1970 would build three
             -- thousand empty weeks to find the handful with anything in them.
             coalesce((select min(d.day) from daily_scores d), p_today),
             p_today
           ) m
  ),
  -- Gaps and islands. A window whose predecessor on the same board is exactly one step
  -- behind continues the stretch; anything else starts a new one. `my_winnings` returns
  -- at most one row per board per window, so there are no ties in this ordering and the
  -- frame below cannot swallow a row it should have counted.
  marked as (
    select w.*,
           case
             when lag(w.won_on) over (
                    partition by w.period, w.mode, w.difficulty order by w.won_on
                  ) = w.won_on - w.step
             then 0 else 1
           end as opens
    from   won w
  ),
  islands as (
    select m.*,
           sum(m.opens) over (
             partition by m.period, m.mode, m.difficulty order by m.won_on
             rows between unbounded preceding and current row
           ) as island
    from   marked m
  )
  select json_build_object(
    'nickname', (
      select p.nickname::text from profiles p
      where  p.id = p_user_id and p.nickname is not null
    ),
    -- Gated on the nickname for the same reason the nickname itself is: a player with no
    -- name is on no board, cannot be tapped, and has no profile for a motto to appear on.
    'motto', (
      select p.motto from profiles p
      where  p.id = p_user_id and p.nickname is not null
    ),
    'achievements', (
      select count(distinct a.achievement_id) from achievements a where a.user_id = p_user_id
    ),
    'totals', coalesce((
      select json_agg(json_build_object(
        'mode', t.mode, 'difficulty', t.difficulty,
        'runs', t.runs, 'hits', t.hits, 'scoreSum', t.score_sum,
        'accSum', t.acc_sum, 'spdSum', t.spd_sum,
        'bestAcc', t.best_acc, 'bestSpd', t.best_spd, 'timeMs', t.time_ms
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
    -- One row per unbroken stretch of holding a day or a week board.
    --
    -- `toDay` is the last day the player actually held it, which for a week means the
    -- Sunday rather than the Monday it is dated by: a stretch of one week reads
    -- `2 AUG – 9 AUG`, not as a single day. Both ends are bare days, unlike a reign's
    -- timestamps — a day board is won by a calendar day and has no instant to report.
    --
    -- No score. The row that draws these shows the board and the stretch, and the score
    -- a board was held with is already in `bests` above for the only board where it is
    -- the record.
    -- Grouped in a subquery and aggregated outside it, the way the `winnings` key below
    -- does: `json_agg` under a `group by` would aggregate within each group and hand back
    -- one row per stretch, each holding an array of one.
    'wins', coalesce((
      select json_agg(json_build_object(
        'period', s.period, 'mode', s.mode, 'difficulty', s.difficulty,
        'fromDay', s.from_day, 'toDay', s.to_day
      ) order by s.from_day desc)
      from (
        select i.period, i.mode, i.difficulty,
               min(i.won_on) as from_day,
               max(i.won_on) + case when i.period = 'day' then 0 else 6 end as to_day
        from   islands i
        group  by i.period, i.mode, i.difficulty, i.island
      ) s
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

-- Signature unchanged, so the existing grant still stands. Restated because a
-- `create or replace` that ever changes an argument list would silently leave the old
-- function — and its grant — in place beside the new one.
grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;
