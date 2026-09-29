-- The best a player has ever played a board, as opposed to how they usually play it.
--
-- `player_totals` could say what a board averages and `scores` what it was best scored,
-- and between them they could not say the one thing a player actually remembers: the run
-- where everything landed. An average over four hundred runs moves by a point a month;
-- the evening you dialled 97% accuracy is a fact about you forever.
--
-- Two columns rather than a per-run table, for the same reason the sums are sums: this
-- is a maximum, and a maximum folds into the row on the way in without reading anything
-- back. Whether the best accuracy and the best score came from the same run is not asked
-- and not answered — they are two different bests, and a player who reads them as one
-- run is reading more into the table than it claims.

-- Zero, not null, for a board played before this shipped: the column starts empty for
-- everyone and fills from the next run on that board. `record_run` writes only a
-- `greatest`, so no history is rewritten and nothing has to be backfilled — a board
-- reads `—` until it is played again, which is honest about what the server knows.
alter table player_totals
  add column best_acc double precision not null default 0,
  add column best_spd double precision not null default 0;

-- ─── Recording a run ─────────────────────────────────────────────────────────
-- Same argument list, so `create or replace` is a new version of this function rather
-- than a second one — nothing to drop and the existing grant still stands. Restated in
-- full from …_profile_time.sql; the two `greatest` clauses are the only change.

create or replace function record_run(
  p_run_id     uuid,
  p_mode       text,
  p_difficulty text,
  p_score      int,
  p_hits       int,
  p_acc_sum    double precision,
  p_spd_sum    double precision,
  p_elapsed_ms bigint default 0
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  -- This run's two factors as percentages, which is what a best is kept in — unlike the
  -- sums beside them, which are only ever divided on read. A run that landed no hit has
  -- no accuracy to speak of, so it offers zero and loses every `greatest` it enters.
  v_acc  double precision := case when p_hits > 0 then 100 * p_acc_sum / p_hits else 0 end;
  v_spd  double precision := case when p_hits > 0 then 100 * p_spd_sum / p_hits else 0 end;
begin
  if v_user is null then
    raise exception 'record_run: not authenticated';
  end if;
  if p_mode not in ('accuracy', 'speed') then
    raise exception 'record_run: unknown mode %', p_mode;
  end if;
  if p_difficulty not in ('easy', 'hard', 'extreme') then
    raise exception 'record_run: unknown difficulty %', p_difficulty;
  end if;
  -- Values no real run can produce. A broken or hostile client cannot be stopped from
  -- lying about one run; it can be stopped from writing a number that makes every
  -- average on that board meaningless forever. Each per-hit factor is bounded by 1 plus
  -- the speed bonus, so twice the hit count is a ceiling with room to spare.
  --
  -- That ceiling matters more now than it did: a sum only ever moved an average by one
  -- run's worth, where a best replaces the figure outright and is never averaged back
  -- down. The bound that kept an average honest is what keeps a best honest too.
  if p_score < 0 or p_hits < 0 or p_acc_sum < 0 or p_spd_sum < 0 or p_elapsed_ms < 0 then
    raise exception 'record_run: negative values';
  end if;
  if p_hits > 5000 or p_score > 1000000 then
    raise exception 'record_run: out of range';
  end if;
  -- A day. The clock only runs while a run is actually being played — the pause screen
  -- stops it — so no honest run comes near this, and a total nobody can dispute is worth
  -- more than the handful of milliseconds a tighter bound would save.
  if p_elapsed_ms > 86400000 then
    raise exception 'record_run: elapsed out of range';
  end if;
  if p_acc_sum > p_hits * 2 or p_spd_sum > p_hits * 2 then
    raise exception 'record_run: factor sums out of range';
  end if;

  insert into run_receipts (run_id, user_id) values (p_run_id, v_user)
  on conflict (run_id) do nothing;
  -- The run is already counted. A replay is a retry whose response was lost, and the
  -- honest answer to it is to do nothing and report success.
  if not found then return; end if;

  insert into player_totals (
    user_id, mode, difficulty, runs, hits, score_sum, acc_sum, spd_sum,
    best_acc, best_spd, time_ms, updated_at
  )
  values (
    v_user, p_mode, p_difficulty, 1, p_hits, p_score, p_acc_sum, p_spd_sum,
    v_acc, v_spd, p_elapsed_ms, now()
  )
  on conflict (user_id, mode, difficulty) do update set
    runs       = player_totals.runs + 1,
    hits       = player_totals.hits + excluded.hits,
    score_sum  = player_totals.score_sum + excluded.score_sum,
    acc_sum    = player_totals.acc_sum + excluded.acc_sum,
    spd_sum    = player_totals.spd_sum + excluded.spd_sum,
    -- The only two columns here that are not a running total. `excluded` carries this
    -- run's percentage, not its sum, which is why they are read from there rather than
    -- recomputed.
    best_acc   = greatest(player_totals.best_acc, excluded.best_acc),
    best_spd   = greatest(player_totals.best_spd, excluded.best_spd),
    time_ms    = player_totals.time_ms + excluded.time_ms,
    updated_at = now();
end;
$$;

-- ─── Reading a profile ───────────────────────────────────────────────────────
-- Restated in full from …_profile_read_restore.sql, which says why: this function is
-- built with `create or replace`, so every migration that touches it has to carry
-- forward everything the ones before it added. `bestAcc` and `bestSpd` in the totals are
-- the only change. Whoever restates it next: start from *this* definition.

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

-- Both signatures unchanged, so the existing grants still stand. Restated because a
-- `create or replace` that ever changes an argument list would silently leave the old
-- function — and its grant — in place beside the new one.
grant execute on function public.record_run(uuid, text, text, int, int, double precision, double precision, bigint) to authenticated;
grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;
