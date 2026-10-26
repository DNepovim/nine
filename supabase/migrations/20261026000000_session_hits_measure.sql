-- A third **measure**: a session board ordered by hits.
--
-- NO SLIP ends a run on the first hit off the exact route, so what a run comes to is how
-- long it lasted — the number of targets it took. Its standings are ordered by that, and
-- two runs that lasted as long are told apart by the higher score, which carries the
-- route and the clock both.
--
-- Nothing about a session already booked moves. Every one of them is `score` or `time`,
-- and every ordering below reads exactly as before for both: the `hits` arm sits ahead of
-- the score arm and is null on every other measure, so it sorts nothing.
--
-- Bodies are copied from their latest definitions — `…_session_time_kept.sql` for the
-- trigger, the board and the card; `…_session_podium.sql`, `…_player_session_places.sql`,
-- `…_previous_session_winner.sql` and `…_session_places.sql` for the rest — and change
-- only where a hits session needs them to.
--
-- Three functions gain a `hits` column in what they return, and a Postgres function's
-- return type cannot be replaced, so those three are dropped and recreated with their
-- grants. The others keep their shape and are replaced in place.

-- ─── The measure ─────────────────────────────────────────────────────────────

alter table challenge_sessions drop constraint challenge_sessions_measure;
alter table challenge_sessions
  add constraint challenge_sessions_measure check (measure in ('score', 'time', 'hits'));

-- ─── Keeping the better row ──────────────────────────────────────────────────
--
-- The race rules below were inferred from `time_ms` alone and still are: a hits session
-- carries no time, so it would otherwise fall to the score rule and keep a long run's
-- row over a short run with a bigger score — or the reverse. So the session's own measure
-- is asked — but only where neither row has a time, which is the one place a hits session
-- can be, so a race's write never pays for the lookup. On `hits`: more hits, then the
-- higher score.

create or replace function prevent_session_downgrade()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.time_ms is null and new.time_ms is null
     and (select measure from challenge_sessions where id = new.session_id) = 'hits' then
    if new.hits <> old.hits then
      if new.hits > old.hits then
        return new;
      end if;
      return old;
    end if;
    if new.best_score < old.best_score then
      return old;
    end if;
    return new;
  end if;
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
-- `hits desc` arm on a hits session, which then falls through to the score.

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
        case when b.measure = 'hits' then s.hits end desc,
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
    case when b.measure = 'hits' then s.hits end desc,
    case when b.measure = 'time' then null else s.best_score end desc,
    s.updated_at asc;
$$;

-- ─── The card on the start screen ────────────────────────────────────────────
--
-- Gains `leader_hits`, so the card can name the leader by the figure they lead on.

drop function if exists open_sessions_with_leaders();

create function open_sessions_with_leaders()
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
  leader_hits    int,
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
    lead_row.hits,
    lead_row.avg_acc,
    lead_row.avg_spd
  from challenge_sessions s
  left join lateral (
    select p.nickname, b.best_score, b.time_ms, b.hits, f.avg_acc, f.avg_spd
    from session_scores b
    join profiles p on p.id = b.user_id
    left join lateral player_factors(b.user_id) f on true
    where b.session_id = s.id and p.nickname is not null
    order by
      case when s.measure = 'time' then b.time_ms is null end asc,
      case when s.measure = 'time' then b.hits end desc,
      case when s.measure = 'time' then b.time_ms end asc nulls last,
      case when s.measure = 'hits' then b.hits end desc,
      case when s.measure = 'time' then null else b.best_score end desc,
      b.updated_at asc
    limit 1
  ) lead_row on true
  where s.closes_at > now()
  order by s.opens_at asc;
$$;

grant execute on function public.open_sessions_with_leaders() to anon, authenticated;

-- ─── The summary ─────────────────────────────────────────────────────────────
--
-- `hits` beside `timeMs`, on each place and on the player's own row. JSON, so the
-- returned table keeps its shape and an older build reads past the new key.

create or replace function my_session_summaries(p_since timestamptz)
returns table (
  id        uuid,
  mode_id   text,
  closes_at timestamptz,
  measure   text,
  players   int,
  places    json,
  mine      json
) language sql stable security definer set search_path = public as $$
  with mine as (
    select ss.session_id, ss.best_score, ss.time_ms, ss.hits, ss.difficulty
    from   session_scores ss
    where  ss.user_id = auth.uid()
  )
  select
    s.id,
    s.mode_id,
    date_trunc('milliseconds', s.closes_at),
    s.measure,
    board.players,
    board.places,
    json_build_object(
      'rank',       board.my_rank,
      'score',      m.best_score,
      'timeMs',     m.time_ms,
      'hits',       m.hits,
      'difficulty', m.difficulty,
      'bonus',      session_podium_bonus(s.id, auth.uid())
    )
  from challenge_sessions s
  join mine m on m.session_id = s.id
  left join lateral (
    select
      coalesce(
        json_agg(json_build_object(
          'rank',     b.rank,
          'nickname', b.nickname,
          'score',    b.best_score,
          'timeMs',   b.time_ms,
          'hits',     b.hits,
          'avgAcc',   b.avg_acc,
          'avgSpd',   b.avg_spd
        ) order by b.rank) filter (where b.rank <= 3),
        '[]'::json
      ) as places,
      count(*)::int as players,
      max(b.rank) filter (where b.user_id = auth.uid()) as my_rank
    from session_board(s.id) b
  ) board on true
  where s.closes_at <= now()
    and date_trunc('milliseconds', s.closes_at) >
        greatest(p_since, now() - interval '30 days')
  order by s.closes_at desc;
$$;

-- ─── A profile's places ──────────────────────────────────────────────────────

drop function if exists player_session_places(uuid);

create function player_session_places(p_user_id uuid)
returns table (
  session_id uuid,
  mode_id    text,
  closes_at  timestamptz,
  measure    text,
  rank       int,
  best_score int,
  time_ms    int,
  hits       int
) language sql stable security definer set search_path = public as $$
  select s.id, s.mode_id, s.closes_at, s.measure, b.rank::int, b.best_score, b.time_ms,
         b.hits
  from   session_scores ss
  join   challenge_sessions s on s.id = ss.session_id
  cross join lateral (
    select x.rank, x.best_score, x.time_ms, x.hits
    from   session_board(s.id) x
    where  x.user_id = p_user_id
  ) b
  where  ss.user_id = p_user_id
    and  now() >= s.closes_at + session_score_grace()
    and  b.rank <= 3
  order  by s.closes_at desc;
$$;

grant execute on function public.player_session_places(uuid) to anon, authenticated;

-- ─── Who won it last time ────────────────────────────────────────────────────

drop function if exists previous_session_winner(uuid);

create function previous_session_winner(p_session_id uuid)
returns table (
  user_id     uuid,
  nickname    text,
  best_score  int,
  time_ms     int,
  hits        int,
  avg_acc     int,
  avg_spd     int
) language sql stable security definer set search_path = public as $$
  select last.user_id, last.nickname, last.best_score, last.time_ms, last.hits,
         last.avg_acc, last.avg_spd
  from (
    select winner.*, prev.closes_at
    from   challenge_sessions this
    join   challenge_sessions prev
      on   prev.mode_id = this.mode_id
     and   prev.id <> this.id
     and   prev.closes_at <= this.opens_at
    cross join lateral (
             select b.user_id, b.nickname, b.best_score, b.time_ms, b.hits,
                    b.avg_acc, b.avg_spd
             from   session_board(prev.id) b
             order  by b.rank
             limit  1
           ) winner
    where  this.id = p_session_id
    order  by prev.closes_at desc
    limit  1
  ) last
  where now() >= last.closes_at + session_score_grace();
$$;

grant execute on function public.previous_session_winner(uuid) to anon, authenticated;

-- ─── The CHALLENGES achievements ─────────────────────────────────────────────
--
-- A photo finish on a hits session is a run one hit short of third, or level with it and
-- beaten on the score — the smallest step the measure has, as a point is on a score
-- session and a tenth of a second on a race.


create or replace function my_session_places()
returns table (
  -- Sessions settled with this player in the top three, and with them first.
  podiums        int,
  wins           int,
  -- Sessions settled with this player just off the podium: within a point of third on a
  -- score session, within a tenth of a second on a race, within a hit on a hits session.
  photo_finishes int,
  -- Sessions whose first score on the board was this player's. Open sessions count: the
  -- first score is first the moment it lands and nothing can come before it afterwards.
  firsts         int
) language sql stable security definer set search_path = public as $$
  with mine as (
    select ss.session_id from session_scores ss where ss.user_id = auth.uid()
  ),
  -- Shut *and* past the grace, the same bound `session_podium_bonus` pays on: a rival
  -- posting inside the grace can still move a place, so a place counted before it is out
  -- is a place that might not be one.
  settled as (
    select s.id, s.measure
    from   challenge_sessions s
    join   mine m on m.session_id = s.id
    where  now() >= s.closes_at + session_score_grace()
  ),
  placed as (
    select st.measure, b.*
    from   settled st
    cross join lateral (
      -- `session_board` rather than a ranking written again here, so a place counted for
      -- an achievement is the place the summary printed. The podium's edge is its worst
      -- row rather than `rank = 3`, which a tie can skip.
      select
        max(x.rank)        filter (where x.user_id = auth.uid()) as my_rank,
        max(x.best_score)  filter (where x.user_id = auth.uid()) as my_score,
        max(x.time_ms)     filter (where x.user_id = auth.uid()) as my_time,
        max(x.hits)        filter (where x.user_id = auth.uid()) as my_hits,
        count(*)           filter (where x.rank <= 3)            as podium_size,
        min(x.best_score)  filter (where x.rank <= 3)            as edge_score,
        max(x.time_ms)     filter (where x.rank <= 3)            as edge_time,
        min(x.hits)        filter (where x.rank <= 3)            as edge_hits
      from session_board(st.id) x
    ) b
  ),
  -- The first row on each of this player's sessions, among the rows the board shows: a
  -- player with no nickname is on no board, so they cannot have been first on one.
  firsts as (
    select m.session_id,
           bool_and(ss.first_at is not null) as counted,
           (array_agg(ss.user_id order by ss.first_at asc))[1] as first_user
    from   mine m
    join   session_scores ss on ss.session_id = m.session_id
    join   profiles p on p.id = ss.user_id and p.nickname is not null
    group  by m.session_id
  )
  select
    (select count(*)::int from placed where my_rank <= 3),
    (select count(*)::int from placed where my_rank = 1),
    (select count(*)::int from placed
      where my_rank > 3 and podium_size >= 3
        and case measure
                 when 'time' then my_time is not null and my_time - edge_time <= 100
                 when 'hits' then edge_hits - my_hits <= 1
                 else edge_score - my_score <= 1
            end),
    (select count(*)::int from firsts where counted and first_user = auth.uid());
$$;

