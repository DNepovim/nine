-- Challenge runs in the analytics.
--
-- Every run figure on the analytics screen — RUNS, PLAYED, MINUTES, HITS, the players
-- behind them, the daily bars and the breakdown — is counted off `run_receipts`, and
-- until now only `record_run` wrote one. That function refuses any mode but accuracy and
-- speed, so a challenge run left no receipt and a day a challenge was on read, on that
-- screen, as a day nobody played. 20261015010000 says as much: "the challenges are absent
-- from the run figures by construction". This is the end of that sentence.
--
-- **A sibling, not a loosened `record_run`.** What `record_run` does after the receipt is
-- move `player_totals`, which is keyed by board and is what fortune and the profile read.
-- A challenge run belongs to its session and reaches the fortune from there; letting it
-- into `player_totals` would credit it twice and file it under a board it was never on.
-- So `record_session_run` writes the receipt and stops. It writes no standings either —
-- `submit_session_score` still owns the session board, and the two are sent side by side.
--
-- **No change to `admin_stats`.** It and `admin_stats_rows` count every receipt there is,
-- admins left out by the role as before, so the figures pick these runs up without a line
-- of either being restated. A challenge row in the breakdown carries the challenge's mode
-- id, which the screen resolves to its name when the build reading it knows the
-- challenge — and prints dim, as the raw id, when it does not.

-- ─── The receipt's session ───────────────────────────────────────────────────
-- Null on every row a board run wrote, which is every row that exists today. `set null`
-- rather than cascade: a deleted session takes its standings with it, but a run that was
-- played is still a run that was played, and the analytics are a count of those.
alter table run_receipts
  add column session_id uuid references challenge_sessions (id) on delete set null;

-- ─── Recording a session run ─────────────────────────────────────────────────
-- The receipt half of `record_run`, with the same contract: posted more than once for a
-- run that posts before it is over, counted once by its id, figures merged by the
-- highest, and closed by the post that says `final`.
--
-- What it does not share:
--
--   * **The mode comes from the session.** The client never names it. A receipt whose
--     mode disagreed with its session would split one challenge across two rows of the
--     breakdown, and the session already knows which challenge it is.
--   * **No window.** `submit_session_score` refuses ten minutes after the close, because
--     a standing has to be settled at some point. A receipt is not a standing: a run
--     played on a train and landing the next morning was still played, and refusing it
--     would take it out of the counts and nothing else.
--   * **No factor sums.** Accuracy and speed averages are a board's figures; a challenge
--     run's receipt leaves them at nought.
create or replace function public.record_session_run(
  p_run_id uuid, p_session_id uuid, p_difficulty text, p_score integer, p_hits integer,
  p_elapsed_ms bigint default 0, p_final boolean default true
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user    uuid := auth.uid();
  v_mode    text;
  v_owner   uuid;
  v_settled boolean;
  v_session uuid;
  v_difficulty text;
begin
  if v_user is null then
    raise exception 'record_session_run: not authenticated';
  end if;
  -- The profile moved to another device while this one was mid-run.
  if not private.session_is_live() then
    raise exception 'record_session_run: session revoked';
  end if;
  if p_difficulty not in ('easy', 'hard', 'extreme') then
    raise exception 'record_session_run: unknown difficulty %', p_difficulty;
  end if;
  if p_score < 0 or p_hits < 0 or p_elapsed_ms < 0 then
    raise exception 'record_session_run: negative values';
  end if;
  if p_hits > 5000 or p_score > 1000000 then
    raise exception 'record_session_run: out of range';
  end if;
  if p_elapsed_ms > 86400000 then
    raise exception 'record_session_run: elapsed out of range';
  end if;

  select mode_id into v_mode from challenge_sessions where id = p_session_id;
  if not found then
    raise exception 'record_session_run: no such session';
  end if;

  select r.user_id, r.settled, r.session_id, r.difficulty
    into v_owner, v_settled, v_session, v_difficulty
    from run_receipts r
   where r.run_id = p_run_id
     for update;

  if found then
    if v_owner <> v_user then return; end if;
    if v_settled then return; end if;
    -- Null is a board run's receipt, and a run id is minted per run: the same id under
    -- a session is a client that has confused two runs, not a run that changed sides.
    if v_session is distinct from p_session_id then
      raise exception 'record_session_run: session changed mid-run';
    end if;
    -- `record_run`'s guard, for the same reason: the upsert below keeps the first rung,
    -- so a second one would be filed under the wrong row of the breakdown in silence.
    if v_difficulty <> p_difficulty then
      raise exception 'record_session_run: difficulty changed mid-run';
    end if;
  end if;

  insert into run_receipts (
    run_id, user_id, mode, difficulty, session_id, score, hits, elapsed_ms, settled
  )
  values (
    p_run_id, v_user, v_mode, p_difficulty, p_session_id,
    p_score, p_hits, p_elapsed_ms, p_final
  )
  on conflict (run_id) do update set
    score      = greatest(run_receipts.score, excluded.score),
    hits       = greatest(run_receipts.hits, excluded.hits),
    elapsed_ms = greatest(run_receipts.elapsed_ms, excluded.elapsed_ms),
    settled    = excluded.settled;
end;
$function$;

revoke all on function public.record_session_run(uuid, uuid, text, integer, integer, bigint, boolean) from public, anon;
grant execute on function public.record_session_run(uuid, uuid, text, integer, integer, bigint, boolean) to authenticated;
