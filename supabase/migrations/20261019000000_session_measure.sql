-- A session board learns to be ordered by something other than the score.
--
-- Until now a **session board** had exactly one shape: `best_score desc`, the places
-- settled on that order, and the leader on the start screen's card picked the same way.
-- That is right for every challenge there has been, and wrong for the first one whose
-- point is *how fast you got through it* — a contest decided by the one figure the
-- challenge is not about.
--
-- ─── The word, before it gets used ───────────────────────────────────────────
--
-- A session's **measure** is the figure its standings are ordered by and its places are
-- settled on: `score` everywhere but a race, where it is `time`. One word per session,
-- and it is a column on the row rather than an argument to the reads.
--
-- That is the decision this migration turns on, so here is why. The server has never
-- heard of a mode — a mode is a value in the app's bundle, not a row — so it has to be
-- *told*, exactly as it is told a session score's `difficulty`. It could be told per
-- read, by whoever is asking. But `open_sessions_with_leaders` takes no arguments and
-- answers for every open session at once, and the leader it names has to be the fastest
-- player on a race and the highest-scoring one on everything else. A per-read argument
-- cannot say two things, so the fact belongs to the row: the planner stamps it when the
-- session is booked, and both reads obey the stamp.
--
-- Not a **headline**, which is which of the two *factors* a run reports. Not a
-- **board**, which has no measure and never will — `scores` has no other column to be
-- ordered by, and an all-time board is always its score.

-- ─── The measure ─────────────────────────────────────────────────────────────

-- Defaulted, so every session already booked reads `score` — which is what every one of
-- them is, and what every client that has never heard of this column will go on asking
-- for.
alter table challenge_sessions
  add column measure text not null default 'score'
    constraint challenge_sessions_measure check (measure in ('score', 'time'));

-- ─── The time ────────────────────────────────────────────────────────────────

-- Nullable, and the null means something: a run posted before this column existed, or a
-- run of a score-measured challenge, has no time and is not claiming one. Every row in
-- the table on the day this lands is exactly that.
alter table session_scores add column time_ms int;

-- The ranked read for a race. `nulls last` is in the index as well as the query so the
-- two agree: a row with no time sinks below every row that has one, rather than sorting
-- first the way a null does by default on an ascending order.
create index session_scores_time_idx
  on session_scores (session_id, time_ms asc nulls last, updated_at asc);

-- ─── Keeping the better row ──────────────────────────────────────────────────
--
-- `session_scores` hung `prevent_score_downgrade` — the same trigger function `scores`
-- and `daily_scores` hang, which reads `new.best_score < old.best_score` and nothing
-- else. On a race that is the wrong question and silently the wrong answer: a player who
-- runs *faster* but scores *less* has their better time refused, and nothing anywhere
-- says why.
--
-- So this is a session-only replacement, and the shared function is **not touched** —
-- editing it is how all three tables get a bug at once.
--
-- One rule, and it needs to know nothing about modes: **if both rows carry a time, the
-- lower time wins; otherwise the higher score wins.** It degrades exactly right at every
-- edge. A score-measured session has no times, so it falls to the score, as before. A
-- race's first run has nothing to compare against and is simply inserted. And a race
-- whose player somehow has an old timeless row keeps the score comparison until a timed
-- run replaces it, which is the only answer available.
create or replace function prevent_session_downgrade()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.time_ms is not null and old.time_ms is not null then
    if new.time_ms >= old.time_ms then
      return old;
    end if;
    return new;
  end if;
  if new.best_score < old.best_score then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists session_scores_no_downgrade on session_scores;

create trigger session_scores_keep_better
  before update on session_scores
  for each row execute function prevent_session_downgrade();

-- ─── The write ───────────────────────────────────────────────────────────────
--
-- Dropped and recreated with one more parameter rather than replaced, for the reason
-- `…_session_controls.sql` records: a Postgres function is its name *and* its argument
-- types, so `create or replace` with an extra parameter leaves the old arity sitting
-- beside it as an overload.
--
-- **The default on `p_time_ms` is what keeps every shipped app working.** A build that
-- has never heard of a time calls this with five arguments, which resolves to this
-- function with the sixth defaulted to null — a score-measured run, which is exactly
-- what it is. Without the default those builds would stop posting session scores the
-- moment this lands, and they would do it quietly.
drop function if exists submit_session_score(uuid, int, int, text, timestamptz);

create or replace function submit_session_score(
  p_session_id  uuid,
  p_score       int,
  p_hits        int,
  p_difficulty  text,
  p_achieved_at timestamptz,
  p_time_ms     int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_opens  timestamptz;
  v_closes timestamptz;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select opens_at, closes_at into v_opens, v_closes
    from challenge_sessions where id = p_session_id;
  if not found then
    raise exception 'submit_session_score: no such session';
  end if;

  if now() < v_opens then
    raise exception 'submit_session_score: that session has not opened';
  end if;
  if now() >= v_closes + interval '10 minutes' then
    raise exception 'submit_session_score: that session has closed';
  end if;

  insert into session_scores
    (session_id, user_id, best_score, hits, difficulty, time_ms, updated_at)
  values
    (p_session_id, v_caller, p_score, p_hits, p_difficulty, p_time_ms, p_achieved_at)
  on conflict (session_id, user_id) do update
    set best_score = excluded.best_score,
        hits       = excluded.hits,
        difficulty = excluded.difficulty,
        time_ms    = excluded.time_ms,
        updated_at = excluded.updated_at;
  -- The trigger above silently keeps the better row, so a worse run is a successful
  -- write that changed nothing. Still deliberate, and now true of two figures rather
  -- than one: the client has nothing to do about it and nothing to tell the player.
end;
$$;

-- ─── The standings ───────────────────────────────────────────────────────────
--
-- Dropped rather than replaced because the returned table gains a column, and Postgres
-- refuses to replace a function whose return type changed.
--
-- The order is the session's own measure. Written as two `case` arms inside one
-- `order by` rather than two functions or dynamic SQL: the whole difference is which of
-- two columns leads, the tie-break is `updated_at` either way, and a reader should be
-- able to see both orders at once.
drop function if exists session_board(uuid);

create or replace function session_board(p_session_id uuid)
returns table (
  rank        bigint,
  user_id     uuid,
  nickname    text,
  best_score  int,
  hits        int,
  time_ms     int,
  achieved_at timestamptz,
  avg_acc     int,
  avg_spd     int
) language sql stable security definer set search_path = public as $$
  with board as (
    select m.measure from challenge_sessions m where m.id = p_session_id
  )
  select
    rank() over (
      order by
        case when b.measure = 'time' then s.time_ms end asc nulls last,
        case when b.measure = 'time' then null else s.best_score end desc,
        s.updated_at asc
    )::bigint,
    s.user_id,
    p.nickname::text,
    s.best_score,
    s.hits,
    s.time_ms,
    s.updated_at,
    f.avg_acc,
    f.avg_spd
  from session_scores s
  cross join board b
  join profiles p on p.id = s.user_id
  -- `left join` for the reason `leaderboard` uses one: a player the counters have never
  -- seen still belongs on the standings, with their name simply drawn uncoloured.
  left join lateral player_factors(s.user_id) f on true
  -- The same rule every board keeps: a player with no nickname has nothing to publish
  -- under. Their score is still stored, and still theirs the moment they pick one.
  where s.session_id = p_session_id and p.nickname is not null
  order by
    case when b.measure = 'time' then s.time_ms end asc nulls last,
    case when b.measure = 'time' then null else s.best_score end desc,
    s.updated_at asc;
$$;

-- ─── The card on the start screen ────────────────────────────────────────────
--
-- Whoever is ahead, by the session's own measure — which is the reason the measure is a
-- column at all. This answers for every open session in one round trip and so cannot be
-- told per call which way to look.
--
-- `leader_time` rides along beside `leader_score` rather than replacing it: the card
-- prints whichever its challenge is about, and the client already knows which that is.
drop function if exists open_sessions_with_leaders();

create or replace function open_sessions_with_leaders()
returns table (
  id             uuid,
  mode_id        text,
  opens_at       timestamptz,
  closes_at      timestamptz,
  teaser_minutes int,
  extended_at    timestamptz,
  measure        text,
  leader_name    text,
  leader_score   int,
  leader_time    int,
  leader_acc     int,
  leader_spd     int
) language sql stable security definer set search_path = public as $$
  select
    s.id, s.mode_id, s.opens_at, s.closes_at,
    -- Three arms, for the reason …_session_controls.sql records at length: the client
    -- types this `number` and multiplies it, so a null arriving there becomes nought
    -- rather than an error, and every teaser in the app would switch off at once.
    coalesce(
      s.teaser_minutes,
      (select int_value from settings where key = 'teaser_minutes'),
      2160
    ),
    s.extended_at,
    s.measure,
    lead_row.nickname::text,
    lead_row.best_score,
    lead_row.time_ms,
    lead_row.avg_acc,
    lead_row.avg_spd
  from challenge_sessions s
  left join lateral (
    select p.nickname, b.best_score, b.time_ms, f.avg_acc, f.avg_spd
    from session_scores b
    join profiles p on p.id = b.user_id
    -- `left join` for the reason `session_board` uses one: a player the counters have
    -- never seen still leads the session, with their name simply drawn uncoloured.
    left join lateral player_factors(b.user_id) f on true
    where b.session_id = s.id and p.nickname is not null
    order by
      case when s.measure = 'time' then b.time_ms end asc nulls last,
      case when s.measure = 'time' then null else b.best_score end desc,
      b.updated_at asc
    limit 1
  ) lead_row on true
  where s.closes_at > now()
  order by s.opens_at asc;
$$;

-- ─── Booking a session says what it is measured by ───────────────────────────
--
-- Both gain `p_measure`, and both are dropped first for the reason above. Defaulted to
-- `score`, so a client that has never heard of a measure books exactly what it books
-- today.
drop function if exists plan_challenge_session(text, timestamptz, timestamptz, int);
drop function if exists edit_challenge_session(uuid, text, timestamptz, timestamptz, int);

create or replace function plan_challenge_session(
  p_mode_id        text,
  p_opens_at       timestamptz,
  p_closes_at      timestamptz,
  p_teaser_minutes int default null,
  p_measure        text default 'score'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := require_admin();
  v_id     uuid;
begin
  if challenge_session_clashes(p_mode_id, p_opens_at, p_closes_at) then
    raise exception 'that challenge is already booked for part of that time';
  end if;
  insert into challenge_sessions
    (mode_id, opens_at, closes_at, teaser_minutes, measure, created_by)
  values
    (p_mode_id, p_opens_at, p_closes_at, p_teaser_minutes, p_measure, v_caller)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function edit_challenge_session(
  p_id             uuid,
  p_mode_id        text,
  p_opens_at       timestamptz,
  p_closes_at      timestamptz,
  p_teaser_minutes int default null,
  p_measure        text default 'score'
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_was    text;
  v_opens  timestamptz;
  v_closes timestamptz;
  v_played int;
begin
  perform require_admin();
  select mode_id, opens_at, closes_at into v_was, v_opens, v_closes
    from challenge_sessions where id = p_id;
  if not found then
    raise exception 'edit_challenge_session: no such session';
  end if;
  select count(*) into v_played from session_scores where session_id = p_id;
  -- The challenge, with the message this guard has carried since it was written: whoever
  -- matches on it should go on matching.
  if v_played > 0 and v_was is distinct from p_mode_id then
    raise exception
      'edit_challenge_session: % % already scored on it, so it cannot change challenge',
      v_played, case when v_played = 1 then 'player has' else 'players have' end;
  end if;
  -- The span. EXTEND is the one way a played window still moves, and it only ever adds
  -- time to the end.
  if v_played > 0
     and (p_opens_at is distinct from v_opens or p_closes_at is distinct from v_closes) then
    raise exception
      'edit_challenge_session: % % already scored on it, so its window cannot be moved — use EXTEND',
      v_played, case when v_played = 1 then 'player has' else 'players have' end;
  end if;
  if challenge_session_clashes(p_mode_id, p_opens_at, p_closes_at, p_id) then
    raise exception 'that challenge is already booked for part of that time';
  end if;
  -- `extended_at` is cleared when the end is rewritten by hand, and that is not tidiness:
  -- the mark is what the card reads to tell players this window was given more time, so a
  -- session extended and then edited back to its original end would go on saying so for a
  -- window that was not. Only reachable while nobody has scored — which is exactly when
  -- an admin is still correcting a booking.
  --
  -- The measure rides with the challenge: it is the challenge's own fact, and the guard
  -- above has already refused any edit that changes the challenge once somebody has
  -- played. So a played session's measure cannot move, which is what keeps its standings
  -- meaning one thing from the first run to the last.
  update challenge_sessions
     set mode_id        = p_mode_id,
         opens_at       = p_opens_at,
         closes_at      = p_closes_at,
         teaser_minutes = p_teaser_minutes,
         measure        = p_measure,
         extended_at    = case
                            when p_closes_at is distinct from v_closes then null
                            else extended_at
                          end
   where id = p_id;
end;
$$;

grant execute on function public.session_board(uuid) to anon, authenticated;
grant execute on function public.open_sessions_with_leaders() to anon, authenticated;
grant execute on function public.submit_session_score(uuid, int, int, text, timestamptz, int)
  to authenticated;
grant execute on function
  public.plan_challenge_session(text, timestamptz, timestamptz, int, text)
  to authenticated;
grant execute on function
  public.edit_challenge_session(uuid, text, timestamptz, timestamptz, int, text)
  to authenticated;
