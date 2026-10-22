-- What the challenges have settled about a player, for the CHALLENGES achievements.
--
-- Five of them are answered here rather than on the device. A **place** is settled on the
-- server the moment a session's window (and its grace) shuts, and the device only ever
-- hears about one through the **summary** — which tells the newest close and no other, so
-- a place read off the summary would be lost for every session closed while the app was
-- shut. Asked here instead, a place counts wherever and whenever it was taken, on a second
-- phone and after a **restore**.
--
-- One row of four counts and nothing else. An achievement asks "at least once" or "three
-- times", never which session, so a list would be shipping rows to be counted on arrival.

-- ─── When a row was first written ────────────────────────────────────────────
--
-- `updated_at` moves every time a player beats their own best, so it cannot say who
-- reached a board first. This can: set on insert and never touched by the upsert in
-- `submit_session_score`, which names the columns it updates and leaves this one out.
--
-- Added bare, then given its default. In one statement Postgres would stamp every existing
-- row with the migration's own instant — a time nothing happened at, and the same one on
-- every row of a session, which would make whoever sorted first by uuid the first to post.
-- Null is the honest value for a row written before anyone was counting, and a session
-- holding one is left out of FIRST FOOTPRINTS below rather than guessed at.
alter table session_scores add column first_at timestamptz;
alter table session_scores alter column first_at set default now();

create or replace function my_session_places()
returns table (
  -- Sessions settled with this player in the top three, and with them first.
  podiums        int,
  wins           int,
  -- Sessions settled with this player just off the podium: within a point of third on a
  -- score session, within a tenth of a second on a race.
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
        count(*)           filter (where x.rank <= 3)            as podium_size,
        min(x.best_score)  filter (where x.rank <= 3)            as edge_score,
        max(x.time_ms)     filter (where x.rank <= 3)            as edge_time
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
        and case when measure = 'time'
                 then my_time is not null and my_time - edge_time <= 100
                 else edge_score - my_score <= 1
            end),
    (select count(*)::int from firsts where counted and first_user = auth.uid());
$$;

-- `authenticated` only, for the reason `my_session_summaries` gives: an anonymous caller
-- has no rows, and the function answers for the caller alone.
grant execute on function public.my_session_places() to authenticated;
