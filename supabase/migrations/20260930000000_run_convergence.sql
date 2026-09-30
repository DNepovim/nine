-- A run's counters, posted as often as its score is — and converging rather than adding.
--
-- Two writers describe one run. `submit_score` publishes a board record the moment it
-- falls, mid-run, because that write is what wakes every other player's bar. `record_run`
-- could only be called once, at game over, because it *added* — so a run that posted a
-- record and then never ended left its score on the board with no run behind it. A
-- profile could read BEST 97 beside a career of one 24-point run, and both numbers were
-- telling the truth about a different set of runs.
--
-- The fix is to let a run be posted repeatedly and have the later post supersede the
-- earlier, so the counters can travel with the score instead of trailing it. That needs
-- the server to remember what a run has already contributed, which is what the receipt
-- becomes: no longer a bare "counted", but the run's own figures, and `player_totals` is
-- moved by the difference between what is posted and what the receipt already held.
--
-- Three properties make this safe to call as often as the client likes:
--
--   * Every figure a run contributes only grows while it is played — hits, score, the
--     factor sums, time — so the receipt keeps a high-water mark per field and a post
--     that arrives late or out of order moves nothing. This is also what protects a run
--     restored from an older snapshot after a hard kill: the tail the device lost is not
--     subtracted back off the board.
--   * `runs` climbs on the receipt's first post and never again, so a run counts once
--     however many times it reports in.
--   * A settled receipt refuses every further post, so the final word is final and a
--     retry whose response was lost still adds nothing.

-- ─── The receipt ─────────────────────────────────────────────────────────────
-- What this run has already contributed. Nullable board columns because the rows that
-- exist today were written before there was anything to remember; they are settled in
-- the same breath, so nothing ever reads them.

alter table run_receipts
  add column mode       text,
  add column difficulty text,
  add column score      bigint           not null default 0,
  add column hits       int              not null default 0,
  add column acc_sum    double precision not null default 0,
  add column spd_sum    double precision not null default 0,
  add column elapsed_ms bigint           not null default 0,
  -- Whether the run's final word has landed. False only while a run is still being
  -- played and has posted early.
  add column settled    boolean not null default false;

-- Every run counted under the old scheme is closed, and its figures are unknowable. Left
-- open, a retry of one of them would read the zeros above as "contributed nothing yet"
-- and count the whole run a second time.
update run_receipts set settled = true;

-- ─── Recording a run ─────────────────────────────────────────────────────────
-- Dropped rather than replaced: `p_final` changes the argument list, and a
-- `create or replace` would leave the eight-argument version in place beside this one,
-- still granted and still adding. The new argument defaults, so a client that has not
-- been updated goes on calling with eight and goes on getting exactly what it got
-- before — one settled post per run, at game over.

drop function if exists public.record_run(
  uuid, text, text, int, int, double precision, double precision, bigint
);

create function record_run(
  p_run_id     uuid,
  p_mode       text,
  p_difficulty text,
  p_score      int,
  p_hits       int,
  p_acc_sum    double precision,
  p_spd_sum    double precision,
  p_elapsed_ms bigint default 0,
  -- Whether the run has finished. A post made mid-run leaves the receipt open for the
  -- next one; the first post that says otherwise closes it for good.
  p_final      boolean default true
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  -- The receipt as it stands, or nothing. Every `v_old_` starts at zero and is only
  -- overwritten when there is a receipt to overwrite it from — a `select ... into` that
  -- finds nothing writes null over its targets, so the defaults are set after the read.
  v_owner      uuid;
  v_settled    boolean;
  v_mode       text;
  v_difficulty text;
  v_old_score   bigint           := 0;
  v_old_hits    int              := 0;
  v_old_acc     double precision := 0;
  v_old_spd     double precision := 0;
  v_old_elapsed bigint           := 0;
  -- Whether this post is the run's first. The one thing that decides `runs`.
  v_fresh boolean;
  v_new_score   bigint;
  v_new_hits    int;
  v_new_acc     double precision;
  v_new_spd     double precision;
  v_new_elapsed bigint;
  -- This run's two factors as percentages, which is what a best is kept in — unlike the
  -- sums beside them, which are only ever divided on read. Offered only by a run that
  -- has finished: a best factor is a property of a whole run, and a run judged on its
  -- first hit would post a perfect one and hold it forever. A run that landed no hit has
  -- no accuracy to speak of, so it offers zero and loses every `greatest` it enters.
  v_acc double precision;
  v_spd double precision;
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

  -- Locked for the length of the transaction, because what is written below is computed
  -- from what is read here: two posts of one run arriving together would otherwise both
  -- measure their delta against the same older figures and both apply it.
  select r.user_id, r.settled, r.mode, r.difficulty,
         r.score, r.hits, r.acc_sum, r.spd_sum, r.elapsed_ms
    into v_owner, v_settled, v_mode, v_difficulty,
         v_old_score, v_old_hits, v_old_acc, v_old_spd, v_old_elapsed
    from run_receipts r
   where r.run_id = p_run_id
     for update;
  v_fresh := not found;

  if v_fresh then
    v_old_score := 0; v_old_hits := 0;
    v_old_acc := 0;   v_old_spd := 0;
    v_old_elapsed := 0;
  else
    -- A receipt belongs to the device that made it. Another account posting under an id
    -- it did not mint is a broken or hostile client, and the safe answer is to change
    -- nothing and say so to nobody.
    if v_owner <> v_user then return; end if;
    -- The run is already closed. A replay is a retry whose response was lost, and the
    -- honest answer to it is to do nothing and report success.
    if v_settled then return; end if;
    -- One run is played on one board. A post that moves it to another is not a later
    -- word about the same run, and the delta below would credit the wrong totals row.
    if v_mode <> p_mode or v_difficulty <> p_difficulty then
      raise exception 'record_run: board changed mid-run';
    end if;
  end if;

  -- The run's contribution, as high as it has ever been posted. Nothing a run has
  -- already put on the board is taken back off it by a later, smaller post.
  v_new_score   := greatest(v_old_score, p_score);
  v_new_hits    := greatest(v_old_hits, p_hits);
  v_new_acc     := greatest(v_old_acc, p_acc_sum);
  v_new_spd     := greatest(v_old_spd, p_spd_sum);
  v_new_elapsed := greatest(v_old_elapsed, p_elapsed_ms);

  v_acc := case when p_final and p_hits > 0 then 100 * p_acc_sum / p_hits else 0 end;
  v_spd := case when p_final and p_hits > 0 then 100 * p_spd_sum / p_hits else 0 end;

  insert into run_receipts (
    run_id, user_id, mode, difficulty,
    score, hits, acc_sum, spd_sum, elapsed_ms, settled
  )
  values (
    p_run_id, v_user, p_mode, p_difficulty,
    v_new_score, v_new_hits, v_new_acc, v_new_spd, v_new_elapsed, p_final
  )
  on conflict (run_id) do update set
    score      = excluded.score,
    hits       = excluded.hits,
    acc_sum    = excluded.acc_sum,
    spd_sum    = excluded.spd_sum,
    elapsed_ms = excluded.elapsed_ms,
    settled    = excluded.settled;

  -- Only the difference. `excluded` carries the deltas rather than the figures, which is
  -- why this reads the way it does: on the insert path there is nothing to differ from,
  -- and a delta against zero is the figure itself.
  insert into player_totals (
    user_id, mode, difficulty, runs, hits, score_sum, acc_sum, spd_sum,
    best_acc, best_spd, time_ms, updated_at
  )
  values (
    v_user, p_mode, p_difficulty,
    case when v_fresh then 1 else 0 end,
    v_new_hits - v_old_hits,
    v_new_score - v_old_score,
    v_new_acc - v_old_acc,
    v_new_spd - v_old_spd,
    v_acc, v_spd,
    v_new_elapsed - v_old_elapsed,
    now()
  )
  on conflict (user_id, mode, difficulty) do update set
    runs       = player_totals.runs + excluded.runs,
    hits       = player_totals.hits + excluded.hits,
    score_sum  = player_totals.score_sum + excluded.score_sum,
    acc_sum    = player_totals.acc_sum + excluded.acc_sum,
    spd_sum    = player_totals.spd_sum + excluded.spd_sum,
    -- The only two columns here that are not a running total, and the only two a
    -- mid-run post leaves alone — it offers zero, which loses.
    best_acc   = greatest(player_totals.best_acc, excluded.best_acc),
    best_spd   = greatest(player_totals.best_spd, excluded.best_spd),
    time_ms    = player_totals.time_ms + excluded.time_ms,
    updated_at = now();
end;
$$;

grant execute on function public.record_run(
  uuid, text, text, int, int, double precision, double precision, bigint, boolean
) to authenticated;
