-- What a closed session left behind, for the player who played it.
--
-- A **summary** is told once, on the first intro a player reaches after a session's
-- window shuts: the three **places** it settled on, where that player themselves came,
-- and nothing else. This is the one read behind it.
--
-- Eligibility is a row rather than a flag. A player is owed a summary exactly when they
-- have a `session_scores` row on the session — which is what "played it at least once"
-- means, is already written the moment they finish a run, and is right on a second phone
-- and after a **restore**. Nothing on the device decides it and nothing has to be kept
-- in step.
--
-- Nothing is added or dropped. `session_board` already answers for a closed session
-- unchanged — it reads `challenge_sessions.measure` and orders by it — and reusing it
-- here is what keeps the podium's order from being written a second time in a second
-- place, free to disagree the day a third measure is added.

create or replace function my_session_summaries(p_since timestamptz)
returns table (
  id        uuid,
  mode_id   text,
  closes_at timestamptz,
  measure   text,
  players   int,
  -- The top three, ranked, as the client draws them. A json array rather than three sets
  -- of flattened columns: a podium is a list of up to three things, and `place_2_name`
  -- beside `place_3_score` is a list pretending not to be one.
  places    json,
  -- This player's own figures, the rung they were set at included. Never null — the join
  -- below is what makes a row exist at all — though `rank` inside it may be, for the
  -- reason the lateral explains.
  mine      json
) language sql stable security definer set search_path = public as $$
  with mine as (
    -- Both halves of this player's half of the answer: the filter that decides which
    -- sessions are theirs, and the figures the card prints under the podium. One scan
    -- rather than an `exists` beside a second lookup of the same row.
    select ss.session_id, ss.best_score, ss.time_ms, ss.difficulty
    from   session_scores ss
    where  ss.user_id = auth.uid()
  )
  select
    s.id,
    s.mode_id,
    -- **Milliseconds, not microseconds**, and this is load-bearing rather than tidy.
    --
    -- The client's whole clock is `number` — milliseconds since the epoch — so the instant
    -- it stores as its watermark is this column floored, and the instant it hands back as
    -- `p_since` is that floored value. Returned at full precision, `closes_at` is
    -- *strictly greater* than the watermark taken from it — 09:47:16.052467 against
    -- 09:47:16.052 — and the `>` below lets the same session through on every launch
    -- forever. A summary is meant to be told once; untruncated it was told every time.
    --
    -- Truncated in both places so the row the client holds is exactly the row this
    -- function will compare it against.
    date_trunc('milliseconds', s.closes_at),
    s.measure,
    board.players,
    board.places,
    json_build_object(
      'rank',   board.my_rank,
      'score',  m.best_score,
      'timeMs', m.time_ms,
      -- The rung the run was played at, which is what prices a point: the fortune is
      -- weighted by difficulty and the page prints what the place was worth. Stored on
      -- the row for the reason `session_scores.difficulty` exists at all — a mode is a
      -- value in the bundle and the server has never heard of one.
      'difficulty', m.difficulty
    )
  from challenge_sessions s
  -- An inner join, and that is the eligibility rule in full: a session this player never
  -- scored on has no row here and so no summary.
  join mine m on m.session_id = s.id
  left join lateral (
    select
      -- `filter` rather than a limited subquery, so the board is walked once for all
      -- three of these. A `json_agg` over no rows is null, which is a session nobody
      -- scored on — an empty array is what the client draws a bare podium from.
      coalesce(
        json_agg(json_build_object(
          'rank',     b.rank,
          'nickname', b.nickname,
          'score',    b.best_score,
          'timeMs',   b.time_ms,
          -- Nullable on purpose, exactly as the card's leader is: a player the counters
          -- have never seen has no saturation and `nameColors` draws them uncoloured.
          -- Defaulting to nought here would make "never counted" and "counted, and bad
          -- at it" the same colour by accident.
          'avgAcc',   b.avg_acc,
          'avgSpd',   b.avg_spd
        ) order by b.rank) filter (where b.rank <= 3),
        '[]'::json
      ) as places,
      count(*)::int as players,
      -- Null for a player with no nickname. `session_board` keeps them off the standings
      -- — the same rule every board in this app holds — and they are off this podium
      -- too, while still having a figure of their own from `mine` above. That split is
      -- the whole reason `mine` does not come off the board.
      max(b.rank) filter (where b.user_id = auth.uid()) as my_rank
    from session_board(s.id) b
  ) board on true
  -- Shut, and shut recently. The floor is the server's own guard against a client that
  -- asks about the epoch; it is deliberately not the client's own fourteen days, which
  -- is a decision about what is still worth telling rather than a bound on a query.
  where s.closes_at <= now()
    and date_trunc('milliseconds', s.closes_at) >
        greatest(p_since, now() - interval '30 days')
  order by s.closes_at desc;
$$;

-- `authenticated` only. An anonymous caller has no `session_scores` rows, so `auth.uid()`
-- is null and the join above can never match — but a grant that cannot return anything is
-- still a grant, and the three public reads beside this one are public because the start
-- screen genuinely needs them before anybody signs in. This one does not.
grant execute on function public.my_session_summaries(timestamptz) to authenticated;
