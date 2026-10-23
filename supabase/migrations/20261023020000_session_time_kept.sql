-- A race is won by a run that finished, and only then by the clock.
--
-- A race's standings were ordered by `time_ms` alone, and its rows were kept by the same
-- comparison. Builds up to and including the one that raced the habit clock in tenths
-- posted two kinds of row that comparison cannot judge:
--
--   * END RUN and RESTART RUN posted the clock a run was left on, so one hit and a quit
--     stood on the session board at 3.1″ — first place, the card's leader, and gold when
--     the window shut — and refused every run that went the distance.
--   * A challenge keeps no `scores` board, so its first point always read as opening one
--     and fired the mid-run post, which carries no time. On the score fallback it could
--     wipe the time a row already held, or block a later timed finish that scored less.
--
-- The client no longer sends either. This keeps the builds already on phones from doing
-- the damage, and ranks what they have left where it belongs.
--
-- ─── The rule ────────────────────────────────────────────────────────────────
--
-- On a race, in order: **a timed row beats an untimed one; more hits beats fewer; then
-- the faster time.** Hits stand in for "finished" because a drill's length is the app's
-- business rather than the server's, and a run that cleared its drill has hit every
-- target in it — so among a race's rows, the most hits *is* the finished ones. A
-- score-measured session has no times and reads exactly as before.
--
-- The same order is written three times below — the trigger, `session_board`, and the
-- card's leader — and `lib/local-scores.ts` keeps it on the device. Everything else that
-- ranks a session (the places, the podium, the summaries, the last winner) reads
-- `session_board`, so it follows.

-- ─── Keeping the better row ──────────────────────────────────────────────────

create or replace function prevent_session_downgrade()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.time_ms is not null and new.time_ms is null then
    return old;
  end if;
  if old.time_ms is null and new.time_ms is not null then
    return new;
  end if;
  if new.time_ms is not null and old.time_ms is not null then
    if new.hits <> old.hits then
      if new.hits > old.hits then
        return new;
      end if;
      return old;
    end if;
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

-- ─── The standings ───────────────────────────────────────────────────────────
--
-- Replaced rather than dropped: the returned table is unchanged, only the order gains a
-- `hits desc` arm on a race. Timed rows still come first by `nulls last`.

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
        case when b.measure = 'time' then s.time_ms is null end asc,
        case when b.measure = 'time' then s.hits end desc,
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
  left join lateral player_factors(s.user_id) f on true
  where s.session_id = p_session_id and p.nickname is not null
  order by
    case when b.measure = 'time' then s.time_ms is null end asc,
    case when b.measure = 'time' then s.hits end desc,
    case when b.measure = 'time' then s.time_ms end asc nulls last,
    case when b.measure = 'time' then null else s.best_score end desc,
    s.updated_at asc;
$$;

-- ─── The card on the start screen ────────────────────────────────────────────

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
    left join lateral player_factors(b.user_id) f on true
    where b.session_id = s.id and p.nickname is not null
    order by
      case when s.measure = 'time' then b.time_ms is null end asc,
      case when s.measure = 'time' then b.hits end desc,
      case when s.measure = 'time' then b.time_ms end asc nulls last,
      case when s.measure = 'time' then null else b.best_score end desc,
      b.updated_at asc
    limit 1
  ) lead_row on true
  where s.closes_at > now()
  order by s.opens_at asc;
$$;
