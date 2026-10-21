-- What a **session** podium is worth, and the one place it is paid.
--
-- Taking a session paid nothing until now. The score itself already reached the player's
-- **fortune** — `sessionTotals` has summed it since …_profile_session_totals.sql — but it
-- reached it at the same rate whether the run came first or last. This is the prize for
-- the place rather than for the points.
--
-- **A bonus on top, never a multiplier.** CLAUDE.md's rule for a fortune is that it only
-- ever grows, and a share applied *to* the score would take fortune off second and third
-- the day it shipped. First is paid their score again, second half of it, third a fifth.
--
-- **A fifth for third, where a board's podium pays a tenth.** The two tables are not the
-- same and should not be: a board window is one of six running every day, where a session
-- is the only contest of its kind while it is on. Third on a board is a mention; third on
-- a session is a place out of everyone who played it.
--
-- **Only closed sessions, and only after the watermark.** A live session's standings still
-- move, so a fortune reckoned from one would wobble under the player; and a watermark is
-- what `winnings_paid.podium_from` already exists to be — the thing that kept every
-- fortune still when the board podium arrived. Without one, every past winner's figure
-- would jump on the day this shipped, with nothing on screen to explain it.

-- The day this begins paying. **Set once and never moved**: a literal here rather than a
-- row precisely so that changing it costs a migration and leaves a record. Sessions that
-- closed before it pay what they always paid, which is the score and nothing else.
create or replace function session_podium_from()
returns timestamptz language sql immutable set search_path = public as $$
  select timestamptz '2026-10-20 00:00:00+00';
$$;

-- What each step of a session's podium is worth, as a share of the winner's own score.
create or replace function session_podium_share(p_rank bigint)
returns numeric language sql immutable set search_path = public as $$
  select case p_rank when 1 then 1.0 when 2 then 0.5 when 3 then 0.2 else 0 end;
$$;

-- How long after a window shuts a score is still taken.
--
-- `submit_session_score` holds the same ten minutes inline, and the two must move
-- together: this is the span during which a session's standings can still change, so it
-- is exactly the span a payment must wait out. Named here rather than repeated as a
-- literal because the one thing worse than a magic number is two of them.
create or replace function session_score_grace()
returns interval language sql immutable set search_path = public as $$
  select interval '10 minutes';
$$;

-- What one player's place on one session added to their fortune, or nought.
--
-- **It waits for the grace, and that is not caution — it is the rule.** A score is still
-- accepted for ten minutes after a window shuts, so for those ten minutes the standings
-- can still move. Paying from the close meant a rival posting inside the grace could push
-- a player off a step and *halve what they had already been paid* — a fortune going down,
-- which CLAUDE.md forbids in the plainest terms it uses anywhere: it only ever grows.
-- Waiting the grace out is what makes a place final before it is worth anything.
--
-- The gates are a `case` rather than a `where` so they genuinely short-circuit: a session
-- still open, one inside its grace, or one that closed before the watermark costs a single
-- row read and never ranks a board. That matters because `player_profile` reaches this
-- once per session the player has ever scored on.
--
-- `session_board` is reused rather than re-ranked, so the place this pays for is the same
-- place the summary drew — a second ordering written here would be free to disagree with
-- it the day a third **measure** is added.
create or replace function session_podium_bonus(p_session_id uuid, p_user_id uuid)
returns int language sql stable set search_path = public as $$
  select case
    when (
      select now() >= s.closes_at + session_score_grace()
         and s.closes_at > session_podium_from()
      from challenge_sessions s where s.id = p_session_id
    )
    then coalesce((
      select round(b.best_score * session_podium_share(b.rank))::int
      from   session_board(p_session_id) b
      where  b.user_id = p_user_id
    ), 0)
    else 0
  end;
$$;

-- The share is read by the client too, so the summary can print what a place was worth
-- without a second table of factors to drift from this one.
grant execute on function public.session_podium_share(bigint) to anon, authenticated;

-- ─── And the summary says what the place paid ────────────────────────────────
--
-- `create or replace` of the function the migration before this one created, adding one
-- key. It could not have carried it then: `session_podium_bonus` is created above, and a
-- `language sql` body is validated the moment it is defined.
--
-- The figure is **returned rather than worked out on the client**, and that is the whole
-- point. A share table on the other side would be a second opinion about money — and it
-- was one, briefly, and already wrong: it had no watermark, so a session that closed
-- before the podium began paying still printed a figure the fortune never received. One
-- answer, in the one place that pays it.
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
    select ss.session_id, ss.best_score, ss.time_ms, ss.difficulty
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

-- ─── The fortune, with the places in it ──────────────────────────────────────
--
-- `create or replace` of the function …_profile_session_totals.sql last defined. The body
-- below is that one's verbatim but for the `sessionTotals` key, for the reason it gave
-- itself: this function is where the nickname guard, the gap-and-islands reign stretches
-- and the podium's own bounds all live, and reconstructing any of them from memory is how
-- a profile quietly starts lying.
create or replace function player_profile(
  p_user_id    uuid,
  p_today      date,
  p_week_since date
) returns json language sql stable security definer set search_path = public as $$
  with
  -- Where this player's winnings are settled to, and when their podium starts. Read once
  -- rather than at each of the two call sites below: two subqueries saying the same thing
  -- is two chances for the paid half and the held half to disagree about the same day.
  --
  -- Empty for a profile that does not exist, which leaves both bounds null and both calls
  -- below returning nothing — the same answer a player with no rows gets.
  settled as (
    select coalesce(wp.paid_through, pr.created_at::date - 1) as paid_through,
           coalesce(wp.podium_from,  pr.created_at::date)     as podium_from
    from   profiles pr
    left join winnings_paid wp on wp.user_id = pr.id
    where  pr.id = p_user_id
  ),
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
             p_today,
             (select s.podium_from from settled s)
           ) m
    -- Holding a board means winning it. The podium pays three deep; a reign is one deep,
    -- and always was.
    where  m.rank = 1
  ),
  -- Gaps and islands. A window whose predecessor on the same board is exactly one step
  -- behind continues the stretch; anything else starts a new one. `won` returns at most
  -- one row per board per window, so there are no ties in this ordering and the frame
  -- below cannot swallow a row it should have counted.
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
    -- ─── What the challenges came to, by rung ────────────────────────────────
    -- The key …_profile_session_totals.sql added, now carrying the podium bonus as well
    -- as the points — the only line of this function that has moved since.
    --
    -- Grouped by difficulty and by nothing else. A session is not a board, so there is no
    -- mode × difficulty pairing to name — what the fortune needs is the rung each run was
    -- played at, because that is what prices a point. The rung is a column on the row
    -- rather than something this function works out: a mode is a value in the bundle and
    -- Postgres has never heard of one. See `session_scores.difficulty`.
    --
    -- `best_score` is all the table keeps — one row per player per session — and that is
    -- the right figure anyway: the per-board half of the fortune sums daily bests too,
    -- not every run ever played.
    'sessionTotals', coalesce((
      select json_agg(json_build_object(
        'difficulty', st.difficulty, 'scoreSum', st.score_sum
      ) order by st.difficulty)
      from (
        -- The run's own points, plus whatever the **place** it took was worth. The
        -- bonus is nought for everything that is not a podium finish on a closed
        -- session after the watermark, so this is the same sum it always was for all
        -- but a handful of rows — see `session_podium_bonus`.
        select ss.difficulty,
               sum(ss.best_score + session_podium_bonus(ss.session_id, ss.user_id))::bigint
                 as score_sum
        from   session_scores ss
        where  ss.user_id = p_user_id
        group  by ss.difficulty
      ) st
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
    -- The scores this player placed with, summed over the half of history that is paid
    -- for, split by window kind **and by step** so the app can weight each.
    --
    -- One row per board per kind per step rather than a pair of sums per board: a second
    -- pair for silver would be four numbers on a row and a third would be six, and the
    -- weighting the app applies is per step anyway. `scoreSum` is raw — `winFactor` in
    -- lib/winnings.ts holds every factor, so a `case rank when 2 then 0.5` here would be
    -- a second definition of the podium in a second language.
    --
    -- Bounded by `paid_through + 1`, exclusive, so the sum covers everything up to and
    -- including the watermark and nothing after it. Windows after it are what
    -- `my_unpaid_winnings` offers; they join this figure when the player accepts them.
    --
    -- **`daySum` and `weekSum` ride along for the build that is already on the phones.**
    -- A migration reaches production before the bundle does — deliberately, since the new
    -- client calls `my_unpaid_winnings` and an un-migrated server has no such function —
    -- so for a while every reader of this key is an app that predates the podium. That app
    -- reads only these two fields, and the backfill cannot save it: the promise it keeps is
    -- about the *value*, and dropping the fields changes the *shape*. Absent, they arrive
    -- as `undefined`, multiply into `NaN`, and the player reads `FORTUNE NaN`.
    --
    -- One rank-one row carries its own sum and every other row carries nought, so an old
    -- client — which adds `daySum × dayFactor + weekSum × weekFactor` over all the rows —
    -- lands on precisely the number it would have had before. A new client never looks at
    -- them: `boardWinnings` in lib/player-profile.ts branches on `rank` being present and
    -- the podium's own weighting takes over. Delete them once no build in the wild reads
    -- them, and not before.
    'winnings', coalesce((
      select json_agg(json_build_object(
        'mode', w.mode, 'difficulty', w.difficulty,
        'period', w.period, 'rank', w.rank, 'scoreSum', w.score_sum,
        'daySum',  case when w.period = 'day'  and w.rank = 1 then w.score_sum else 0 end,
        'weekSum', case when w.period = 'week' and w.rank = 1 then w.score_sum else 0 end
      ) order by w.mode, w.difficulty, w.period, w.rank)
      from (
        select m.mode, m.difficulty, m.period, m.rank, sum(m.best_score) as score_sum
        from   my_winnings(
                 p_user_id,
                 coalesce((select min(d.day) from daily_scores d), p_today),
                 (select s.paid_through + 1 from settled s),
                 (select s.podium_from from settled s)
               ) m
        group  by m.mode, m.difficulty, m.period, m.rank
      ) w
    ), '[]'::json)
  );
$$;
