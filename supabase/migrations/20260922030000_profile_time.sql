-- How long a player has spent playing, on their profile.
--
-- The one thing the lifetime row could not say. `runs` and `hits` count what happened and
-- the two factor sums say how well, but nothing on the board or in the counters knew how
-- long any of it took — so a profile could tell you a player had landed four thousand
-- hits and not whether that was a fortnight or a year of evenings.
--
-- Summed per board like everything else in `player_totals`, and added up across the six
-- on read. A run's length is already frozen when the game over screen appears
-- (`elapsedMs` in machines/game.ts), which is the number sent here.

alter table player_totals add column time_ms bigint not null default 0;

-- ─── Recording a run ─────────────────────────────────────────────────────────
-- Dropped and recreated rather than replaced: `create or replace` with a different
-- argument list makes a second function rather than a new version of this one, and
-- PostgREST would then have two candidates for the same call.
--
-- `p_elapsed_ms` carries a default so that a device still running the previous build —
-- one with a queued run written before this shipped, or simply not updated yet — keeps
-- counting runs instead of having every submit refused. Such a run lands with a length of
-- zero, which is the truth about what that client knew.
--
-- Everything else is the previous definition unchanged.

drop function if exists record_run(uuid, text, text, int, int, double precision, double precision);

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
    user_id, mode, difficulty, runs, hits, score_sum, acc_sum, spd_sum, time_ms, updated_at
  )
  values (
    v_user, p_mode, p_difficulty, 1, p_hits, p_score, p_acc_sum, p_spd_sum, p_elapsed_ms, now()
  )
  on conflict (user_id, mode, difficulty) do update set
    runs       = player_totals.runs + 1,
    hits       = player_totals.hits + excluded.hits,
    score_sum  = player_totals.score_sum + excluded.score_sum,
    acc_sum    = player_totals.acc_sum + excluded.acc_sum,
    spd_sum    = player_totals.spd_sum + excluded.spd_sum,
    time_ms    = player_totals.time_ms + excluded.time_ms,
    updated_at = now();
end;
$$;

grant execute on function public.record_run(uuid, text, text, int, int, double precision, double precision, bigint) to authenticated;

-- ─── Reading a profile ───────────────────────────────────────────────────────
-- Everything but `timeMs` in the totals is the previous definition unchanged.

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
    'achievements', (
      select count(distinct a.achievement_id) from achievements a where a.user_id = p_user_id
    ),
    'totals', coalesce((
      select json_agg(json_build_object(
        'mode', t.mode, 'difficulty', t.difficulty,
        'runs', t.runs, 'hits', t.hits, 'scoreSum', t.score_sum,
        'accSum', t.acc_sum, 'spdSum', t.spd_sum, 'timeMs', t.time_ms
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
    ), '[]'::json)
  );
$$;

grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;
