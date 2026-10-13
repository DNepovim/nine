-- What a player's challenge runs came to, on their profile.
--
-- The client has read `sessionTotals` off this RPC since challenges reached players, and
-- nothing ever put the key there: `lifetimeOf` carries a `SessionTotals` term that was
-- permanently handed an empty list, so every point ever scored in a challenge was missing
-- from every FORTUNE. This is the other half of that change and it should have shipped in
-- the same breath.
--
-- `coalesce(…, '[]')` here and `?? []` on the reading side are the usual pair: a client
-- that predates the key reads nothing and draws the fortune it always did, and a client
-- that postdates it reads an empty list from a server with no sessions yet. Neither has
-- to know which side moved first.
--
-- The body below is …_winnings_accepted.sql's verbatim but for the one key — every other
-- line is copied rather than retyped, because this function is where the nickname guard,
-- the gap-and-islands reign stretches and the podium's own bounds all live, and
-- reconstructing any of them from memory is how a profile quietly starts lying.

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
    -- The new key, and the only line of this function that is not what
    -- …_winnings_accepted.sql left it.
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
        select ss.difficulty, sum(ss.best_score)::bigint as score_sum
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
