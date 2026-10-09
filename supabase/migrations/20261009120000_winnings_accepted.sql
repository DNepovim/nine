-- Winnings a player accepts, and a podium that pays three deep.
--
-- Two changes to one mechanism. Winnings used to be a fact already settled: the fortune
-- had grown by the time the card said so, because the whole figure was a function of
-- `daily_scores` and nothing had to be pressed. And only rank one was paid, so second
-- place on a board six people played got what last place got.
--
-- Both are fixed without storing a reward. What arrives here is a **watermark**: the day
-- a player's winnings are paid through. The fortune counts windows up to it, the launch
-- offers windows after it, and accepting is the one thing that moves it. So winnings stay
-- derived from a table that is already here — no ledger of pending rewards, no nightly
-- job, no second number that can drift from the boards it came from — and the player
-- still has to press something.
--
-- The promise this migration has to keep is that **no existing fortune moves**. That is
-- what the backfill below is: every profile is settled to yesterday, so every window that
-- has already closed is already paid, and the button governs only what closes from here.
-- Get the backfill wrong and every player watches their fortune fall to their scored
-- points alone.
--
-- `podium_from` is the second half of the same promise. Ranks two and three pay only for
-- windows on or after it, so a player's history of second places does not land in their
-- fortune the day this ships. It is set once, at backfill, and never moves — unlike
-- `paid_through`, which is the one that advances.
--
-- Depends on `private.session_is_live()` from …_session_bound_writes.sql: accepting is a
-- write, and a profile that has moved to another phone may not settle rewards from the
-- one it left.
--
-- See docs/work/2026-10-09-claimed-winnings/spec.md.

-- ─── Where a player's winnings are settled to ────────────────────────────────
-- Its own table rather than two columns on `profiles`, which carries a `public read`
-- policy: a paid-through day there would publish when each player last opened the app to
-- anybody who asked. Here nothing publishes it, because nothing can read it —

create table winnings_paid (
  user_id      uuid primary key references profiles (id) on delete cascade,
  -- The last day whose winnings are in this player's fortune. Moves forward only.
  paid_through date not null,
  -- The first day ranks two and three pay for. Set once and never moved.
  podium_from  date not null
);

-- — RLS on and **no policies at all**. Every read and write below is `security definer`
-- and so goes around RLS entirely; a table with RLS enabled and nothing granting access
-- is unreachable any other way. There is deliberately no "own row" read policy: the
-- client never needs the number, only the rewards it implies.
alter table winnings_paid enable row level security;

-- ─── The backfill, which is the whole promise ────────────────────────────────
-- Yesterday, because today's own day has not closed and so cannot have been won. The
-- podium starts today, so the first **day** it pays for is the one closing tonight.
--
-- Weeks come in later than that, and it is worth being exact about why. A window is held
-- against `podium_from` by the date it is filed under, and a week is filed under its
-- Monday — so the week in progress when this runs is dated before the podium began and
-- pays gold only, however many days of it fall after. The first week to pay silver and
-- bronze is the one starting on the next Monday. That is the conservative reading and the
-- intended one: a week mostly played before the podium existed should not pay for places
-- nobody was competing for.
--
-- One statement, one `current_date`, every profile — including the ones with no scores at
-- all, whose rows cost nothing and keep the "no row means a new profile" rule below true.
--
-- `current_date` is the **server's**, and the app reasons on the Prague clock. Run this in
-- the hour or two where Prague is already on the next date and `paid_through` lands a day
-- early, so yesterday's winnings leave the fortune until they are accepted. Nothing is
-- lost — they are re-offered on the next launch and restored by the press — but there is
-- no reason to field the question, so deploy outside 22:00–00:00 UTC.

insert into winnings_paid (user_id, paid_through, podium_from)
select p.id, current_date - 1, current_date
from   profiles p
on conflict (user_id) do nothing;

-- ─── Who won what, three deep ────────────────────────────────────────────────
-- Dropped rather than replaced. `create or replace` with a fourth argument would leave
-- the three-argument function, and its grants, standing beside the new one — the trap
-- …_winnings.sql warns about in its own closing comment, now actually sprung.

drop function if exists public.my_winnings(uuid, date, date);

-- Every podium place this player took in a window that closed in [p_from_day, p_today).
--
-- The winner rule is unchanged and still the one `past_winners` encodes: highest score in
-- the window, ties to whoever reached it first, no zeros, and no nickname means no board
-- and so no win. What is new is that it keeps going past the winner — `row_number` rather
-- than `distinct on`, cut at three. Rank one returns exactly the rows the old function
-- did, which is what lets the backfilled fortune stay where it was.
--
-- `best_score` is **this player's own** score at their place, not the winner's. For rank
-- one those are the same number.
--
-- Bounds are still passed in rather than computed here, for the reason they always were:
-- the app draws them on the Prague clock and a second definition in SQL is a second thing
-- to keep in step. `p_podium_from` joins them — the caller knows which of a player's
-- windows predate the podium.

create function my_winnings(
  p_user_id  uuid,
  -- First day to look at, inclusive.
  p_from_day date,
  -- Exclusive upper bound. Today, for an offer; the day after `paid_through`, for the
  -- half of history that is already paid.
  p_today    date,
  -- Ranks two and three are suppressed for windows that closed before this day.
  p_podium_from date
) returns table (
  period     text,
  mode       text,
  difficulty text,
  -- The day placed on, or the Monday of the week placed in.
  won_on     date,
  best_score int,
  "rank"     int
) language sql stable security definer set search_path = public as $$
  -- Which boards and days this player was even on. Ranking every player's day across all
  -- of history, and only then asking which rows are this player's, is the shape the old
  -- `distinct on` could answer from the index; a window function cannot be filtered
  -- before it runs. Narrowing to the player's own boards and days first keeps the work
  -- proportional to one career rather than to the whole table — and changes no answer,
  -- since a window this player has no row in cannot be one they placed in.
  with mine as (
    select distinct d.mode, d.difficulty, d.day
    from   daily_scores d
    where  d.user_id = p_user_id
      and  d.day >= p_from_day and d.day < p_today
      and  d.best_score > 0
  ),
  day_podium as (
    select d.mode, d.difficulty, d.day, d.user_id, d.best_score,
           row_number() over (
             partition by d.mode, d.difficulty, d.day
             order by d.best_score desc, d.updated_at asc
           ) as place
    from   daily_scores d
    join   mine m
      on   m.mode = d.mode and m.difficulty = d.difficulty and m.day = d.day
    join   profiles pr on pr.id = d.user_id and pr.nickname is not null
    where  d.best_score > 0
  ),
  -- The Mondays of every week that closed inside the span, exactly as before:
  -- `date_trunc('week', …)` is Monday in Postgres, which is what `weekStart` in
  -- lib/leaderboard-period.ts means too. A marker mid-week means that week had not closed
  -- when it was set and is still owed; a week that closed earlier has an earlier Monday
  -- and falls outside the series.
  weeks as (
    select generate_series(
             date_trunc('week', p_from_day::timestamp)::date,
             date_trunc('week', p_today::timestamp)::date - 7,
             interval '7 days'
           )::date as from_day
  ),
  my_weeks as (
    select distinct w.from_day, d.mode, d.difficulty
    from   weeks w
    join   daily_scores d
      on   d.user_id = p_user_id
      and  d.day between w.from_day and w.from_day + 6
      and  d.best_score > 0
  ),
  -- A period board ranks each player's **best day** in the window, so a week has to be
  -- reduced to one row per player before anybody is ranked. Ranking the raw days instead
  -- would let one player's three good days fill all three steps of the podium — which is
  -- a mistake the old function could not make, having only ever looked for the top row.
  week_best as (
    select distinct on (w.from_day, d.mode, d.difficulty, d.user_id)
           w.from_day, d.mode, d.difficulty, d.user_id, d.best_score, d.updated_at
    from   my_weeks w
    join   daily_scores d
      on   d.mode = w.mode and d.difficulty = w.difficulty
      and  d.day between w.from_day and w.from_day + 6
      and  d.best_score > 0
    join   profiles pr on pr.id = d.user_id and pr.nickname is not null
    order  by w.from_day, d.mode, d.difficulty, d.user_id,
              d.best_score desc, d.updated_at asc
  ),
  week_podium as (
    select b.from_day, b.mode, b.difficulty, b.user_id, b.best_score,
           row_number() over (
             partition by b.from_day, b.mode, b.difficulty
             order by b.best_score desc, b.updated_at asc
           ) as place
    from   week_best b
  )
  select 'day'::text, p.mode, p.difficulty, p.day, p.best_score, p.place::int
  from   day_podium p
  where  p.user_id = p_user_id
    and  p.place <= 3
    and  (p.place = 1 or p.day >= p_podium_from)
  union all
  select 'week'::text, p.mode, p.difficulty, p.from_day, p.best_score, p.place::int
  from   week_podium p
  where  p.user_id = p_user_id
    and  p.place <= 3
    and  (p.place = 1 or p.from_day >= p_podium_from)
$$;

-- No grant to `anon` or `authenticated`. The client used to call this directly and now
-- calls `my_unpaid_winnings`, which knows where the player's watermark is; this is a
-- primitive that both of the functions below are built on, and nothing else.
revoke all on function public.my_winnings(uuid, date, date, date) from public;

-- ─── What a launch has to offer ──────────────────────────────────────────────
-- Everything this player has placed in that is not paid for yet: the windows after their
-- watermark, up to but not including today, whose own day has not closed.
--
-- `auth.uid()` rather than a user id argument, unlike every read beside it. What a player
-- is *owed* is the one thing on this path that is nobody else's business — a board is
-- public, a fortune is public, an unaccepted reward is not.
--
-- A profile with no row in `winnings_paid` was created after the backfill ran, so it is
-- settled to the day before it existed and its podium starts the day it did: nobody can
-- have placed in a window that closed before they had an account.

create or replace function my_unpaid_winnings(p_today date)
returns table (
  period     text,
  mode       text,
  difficulty text,
  won_on     date,
  best_score int,
  "rank"     int
) language plpgsql stable security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_from   date;
  v_podium date;
begin
  if v_user is null then
    raise exception 'my_unpaid_winnings: not authenticated';
  end if;

  select coalesce(w.paid_through, p.created_at::date - 1) + 1,
         coalesce(w.podium_from,  p.created_at::date)
    into v_from, v_podium
    from profiles p
    left join winnings_paid w on w.user_id = p.id
   where p.id = v_user;

  -- No profile row at all: nothing has been played under this account, so nothing is
  -- owed. Returning empty rather than raising — this is a read on a launch path, and a
  -- fresh account is not an error.
  if v_from is null then
    return;
  end if;

  return query
    select m.period, m.mode, m.difficulty, m.won_on, m.best_score, m."rank"
    from   my_winnings(v_user, v_from, p_today, v_podium) m;
end;
$$;

-- Revoked from `public` before being granted, the way …_session_bound_writes.sql does it:
-- `create function` grants execute to `PUBLIC` by default, so a bare `grant … to
-- authenticated` leaves `anon` holding it too. `auth.uid()` already refuses such a call, so
-- this closes a surface rather than a hole — but the surface should not be open.
revoke all on function public.my_unpaid_winnings(date) from public;
grant execute on function public.my_unpaid_winnings(date) to authenticated;

-- ─── Accepting ───────────────────────────────────────────────────────────────
-- The only write on this path, and the first thing anywhere near winnings that mutates.
--
-- `greatest`, so the watermark moves forward or not at all. Backwards would re-offer a
-- window that has been paid and pay it twice, which is the one way a derived fortune can
-- be made to lie. It is also what makes a second press, or a retried request, free:
-- accepting the same day twice lands on the same number.
--
-- Shaped after `record_run`, which is the other `security definer` write the app makes:
-- authenticated, session still live, arguments range-checked, and raising rather than
-- returning quietly — the client treats a failed accept as a reward still waiting, which
-- is exactly what it is.

create or replace function accept_winnings(p_today date)
returns date
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_created date;
  v_through date;
begin
  if v_user is null then
    raise exception 'accept_winnings: not authenticated';
  end if;
  -- The profile moved to another device while this one held an unaccepted reward.
  if not private.session_is_live() then
    raise exception 'accept_winnings: session revoked';
  end if;
  -- The day comes off the client's Prague clock, as every other bound here does. Trusted,
  -- but not past the point where a wrong one would matter: a day either side covers every
  -- timezone the clock can legitimately be in.
  if p_today > current_date + 1 or p_today < current_date - 1 then
    raise exception 'accept_winnings: day out of range %', p_today;
  end if;

  select p.created_at::date into v_created from profiles p where p.id = v_user;
  if v_created is null then
    raise exception 'accept_winnings: no profile';
  end if;

  -- Yesterday, never today: today's own day has not closed, and settling it would skip
  -- the window the moment it closes tonight.
  --
  -- `podium_from` is written only on the insert. A player who first accepts today, having
  -- joined after the backfill, has their podium start the day they joined; one whose row
  -- the backfill wrote keeps the day it set, because the `do update` does not touch it.
  insert into winnings_paid (user_id, paid_through, podium_from)
  values (v_user, p_today - 1, v_created)
  on conflict (user_id) do update
    set paid_through = greatest(winnings_paid.paid_through, excluded.paid_through)
  returning winnings_paid.paid_through into v_through;

  return v_through;
end;
$$;

-- Revoked from `public` first, for the reason `my_unpaid_winnings` gives above. This one is
-- a write, so it matters more: the only thing standing between `anon` and this function
-- would otherwise be the `auth.uid()` check inside it.
revoke all on function public.accept_winnings(date) from public;
grant execute on function public.accept_winnings(date) to authenticated;

-- ─── Reading a profile ───────────────────────────────────────────────────────
-- Restated in full from …_profile_held_boards.sql, which says why: this function is built
-- with `create or replace`, so every migration that touches it carries forward everything
-- the ones before it added — `motto`, `achievements`, the totals' `bestAcc`/`bestSpd`/
-- `timeMs`, `wins`, and `winnings`. Two changes here. Whoever restates it next: start from
-- *this* definition.
--
-- **`winnings` is now bounded by the watermark** rather than by today, and split by step
-- as well as by window kind. Everything after the watermark is offered to the player
-- instead, and is not in this figure until they accept it.
--
-- **`wins` takes rank one only.** It draws MEDALS HELD — the stretches a player *held* a
-- board — and `my_winnings` no longer answers that question on its own. Coming third on a
-- board every day for a week is not a week of holding it.

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

-- Signature unchanged, so the existing grant still stands. Restated because a
-- `create or replace` that ever changes an argument list would silently leave the old
-- function — and its grant — in place beside the new one.
grant execute on function public.player_profile(uuid, date, date) to anon, authenticated;
