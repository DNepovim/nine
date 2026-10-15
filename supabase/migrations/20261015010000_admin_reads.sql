-- What the admin screen reads: the figures, and the messages players have sent in.
--
-- ─── The figures ─────────────────────────────────────────────────────────────
--
-- The admin screen had two halves — who sees what, and when a challenge is on — and both
-- of them edit. Nothing anywhere said how the thing was going: how many profiles there
-- are, how many of them named themselves, how many runs were played yesterday, which
-- board they were played on. Every one of those facts was already in this database, in
-- six tables nobody was asking.
--
-- One function rather than six, and one round trip rather than fourteen: the screen draws
-- a window's figures, a fortnight of daily bars and a split by board all at once, and a
-- call apiece would have the tiles arriving before the chart under them. It returns
-- `jsonb` rather than a row set for the same reason — the answer is a shape, not a table,
-- and `returns table` would have meant one function per block of the screen.
--
-- ─── Why this one is guarded ─────────────────────────────────────────────────
--
-- The other admin reads are not: `feature_stats` and `role_stats` are `stable` functions
-- over tables every client can already select, and a guard would have suggested the
-- counts were secret while the rows they count are not.
--
-- This is the opposite case on both halves. `run_receipts` is server-only — RLS enabled
-- with no policy, which is how this schema says *for the security-definer path alone* —
-- and `feedback` is a player writing to us in confidence. So this is `security definer`,
-- which gets past both, and therefore must ask who is calling. It asks the same question
-- every write in the feature system asks, in the same words: `has_feature(auth.uid(),
-- 'admin')`, which reads the caller's own resolved set rather than `profiles.role`.
--
-- Nothing here returns a person. Every figure is a count, a sum or a group — the screen
-- says *how many*, never *who*, and a function that cannot name anybody cannot leak
-- anybody even if the guard above it is one day got past.
--
-- ─── The clock ───────────────────────────────────────────────────────────────
--
-- The window arrives as two Prague days from the client, the way `weekly_recap` takes
-- its own: the app reasons on the Prague clock (lib/leaderboard-period.ts) and a second
-- definition of when a day turns is a second thing to keep in step. Every instant below
-- is converted the one way this schema converts them — `at time zone 'Europe/Prague'`,
-- which reads the IANA zone rather than re-deriving the rule.
--
-- ─── What it cannot see ──────────────────────────────────────────────────────
--
-- `run_receipts` is pruned after thirty days by `cleanup_run_receipts`, so a month is the
-- whole of the history there is and the figures stop rather than tail off. The screen
-- says so under the chart. And a receipt exists only for a scored run on a board —
-- `record_run` refuses any mode but accuracy and speed — so trainee, arcade and the
-- challenges are absent from the run figures by construction. Challenges have their own
-- block, counted off `session_scores`, which is the only place they are written at all.

create or replace function admin_stats(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- The window before this one, of the same length, for the arrow beside each figure. A
  -- figure on its own says nothing about whether it is good news.
  v_span int  := (p_to - p_from) + 1;
  v_prev_to   date := p_from - 1;
  v_prev_from date := p_from - v_span;
  -- The daily chart is a fortnight ending on the window's last day whatever the window
  -- is: a bar per day is the one block here that is worth the same amount at every
  -- setting, and a one-bar chart for TODAY would be a figure wearing a frame.
  v_series_from date := p_to - 13;
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_stats: not an admin';
  end if;

  return jsonb_build_object(
    'from', p_from,
    'to',   p_to,

    -- ── Profiles ──
    -- `named` is every profile that has a nickname, not only the new ones: it is the
    -- share of the whole population that has gone as far as naming itself, which is the
    -- one conversion this app has. `joined_named` is the same question asked of the
    -- window — a profile that arrived in it and has since been named. There is no
    -- timestamp on the nickname itself, so that is as close as this gets, and the screen
    -- does not claim otherwise.
    'players', (
      select jsonb_build_object(
        'total',        count(*),
        'named',        count(nickname),
        'joined',       count(*) filter (where day between p_from and p_to),
        'joined_named', count(nickname) filter (where day between p_from and p_to),
        'joined_before',count(*) filter (where day between v_prev_from and v_prev_to)
      )
      from (
        select nickname, (created_at at time zone 'Europe/Prague')::date as day
        from profiles
      ) p
    ),

    -- ── Runs ──
    -- One row per run that ever posted, so `runs` counts runs rather than submissions: a
    -- run posting early mid-run and again at game over writes one receipt either way.
    -- `players` is the distinct count over the same window, which is the only active-player
    -- figure this database can answer.
    'runs', (
      select jsonb_build_object(
        'runs',    count(*) filter (where day between p_from and p_to),
        'players', count(distinct user_id) filter (where day between p_from and p_to),
        'hits',    coalesce(sum(hits) filter (where day between p_from and p_to), 0),
        'minutes', round(
                     coalesce(sum(elapsed_ms) filter (where day between p_from and p_to), 0)
                     / 60000.0
                   ),
        'before',  count(*) filter (where day between v_prev_from and v_prev_to)
      )
      from (
        select user_id, hits, elapsed_ms,
               (at at time zone 'Europe/Prague')::date as day
        from run_receipts
      ) r
    ),

    -- ── A bar a day ──
    -- Generated from the dates rather than from the rows, so a day nobody played is a
    -- zero in the series instead of a gap the chart would close up.
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               -- Cast, and not decoration: `generate_series` over dates answers in
               -- `timestamptz`, and the app reads these back with `formatShortDay`,
               -- which wants a bare ISO day and prints the raw string when it does not
               -- get one.
               'day',     d.day::date,
               'runs',    coalesce(r.runs, 0),
               'players', coalesce(r.players, 0)
             ) order by d.day::date), '[]'::jsonb)
      from generate_series(v_series_from, p_to, interval '1 day') as d(day)
      left join (
        select (at at time zone 'Europe/Prague')::date as day,
               count(*)                  as runs,
               count(distinct user_id)    as players
        from run_receipts
        group by 1
      ) r on r.day = d.day::date
    ),

    -- ── Which board ──
    -- Mode and difficulty together, because that pairing is what this app calls a board
    -- and the two questions — which mode, which rung — are read off the one list.
    'boards', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'mode',       b.mode,
               'difficulty', b.difficulty,
               'runs',       b.runs,
               'players',    b.players
             ) order by b.runs desc), '[]'::jsonb)
      from (
        select coalesce(mode, 'unknown')       as mode,
               coalesce(difficulty, 'unknown') as difficulty,
               count(*)                        as runs,
               count(distinct user_id)         as players
        from run_receipts
        where (at at time zone 'Europe/Prague')::date between p_from and p_to
        group by 1, 2
      ) b
    ),

    -- ── The challenges that ran ──
    -- The five most recent sessions and what each drew, whatever window is selected: a
    -- session is its own window, and filtering these by the one on screen would hide the
    -- thing somebody opened this block to see. Null `best` is a session nobody has posted
    -- a score on yet, which is different from one that drew nobody and is drawn as such.
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',       s.id,
               'mode_id',  s.mode_id,
               'opens_at', s.opens_at,
               'players',  (select count(*) from session_scores x where x.session_id = s.id),
               'best',     (select max(best_score) from session_scores x where x.session_id = s.id)
             ) order by s.opens_at desc), '[]'::jsonb)
      from (select * from challenge_sessions order by opens_at desc limit 5) s
    ),

    -- ── Everything else worth one figure ──
    -- Five counts that each have a table to themselves and would not earn a block.
    -- `feedback_owed` is the one that is not a window figure at all: it is every message
    -- still waiting for an answer, which is a thing to go and do rather than a thing that
    -- happened this week.
    'pulse', jsonb_build_object(
      'feedback', (
        select count(*) from feedback
        where (created_at at time zone 'Europe/Prague')::date between p_from and p_to
      ),
      'feedback_owed', (select count(*) from feedback where answer is null),
      'achievements', (
        select count(*) from achievements
        where (earned_at at time zone 'Europe/Prague')::date between p_from and p_to
      ),
      'rooms', (
        select count(*) from rooms
        where (created_at at time zone 'Europe/Prague')::date between p_from and p_to
      ),
      -- A board changing hands: a reign that began inside the window. The all-time
      -- boards only — `board_reigns` is the one of the three periods that is stored.
      'reigns', (
        select count(*) from board_reigns
        where (took_at at time zone 'Europe/Prague')::date between p_from and p_to
      )
    )
  );
end;
$$;

revoke all on function public.admin_stats(date, date) from public;
grant execute on function public.admin_stats(date, date) to authenticated;


-- ─── The messages ────────────────────────────────────────────────────────────
--
-- Every message a player has sent in, and whether it has been answered.
--
-- The screen this feeds reads rather than writes: answering is still done by hand, by the
-- `answer-feedback` skill, which needs the row id this list prints. What the app gains is
-- the half that was missing — somebody noticing there *is* a message, which until now
-- meant going and looking in the database.
--
-- Guarded and `security definer` for the reason `admin_stats` is, and more plainly: a
-- `feedback` row is a player writing to us, the policies on that table let a player read
-- their own and nobody else's, and this hands all of them over. It is the one read in
-- this file that names people, and it names them because an answer has to be addressed.
create or replace function admin_feedback()
returns table (
  id            uuid,
  -- Who wrote it, which the screen needs for one reason: a nickname in this app is drawn
  -- in the gradient that player's own averages earn them, and `GradientName` is fed by
  -- id. Null for a message whose author has since removed their profile.
  user_id       uuid,
  nickname      text,
  message       text,
  mode          text,
  difficulty    text,
  score         int,
  build         text,
  created_at    timestamptz,
  answer        text,
  answered_at   timestamptz,
  -- Whether the player has read the answer. The third state of a message and the one the
  -- list cannot otherwise show: answered and collected is finished with, answered and not
  -- yet seen is still in the post.
  answer_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_feedback: not an admin';
  end if;

  return query
    select f.id,
           f.user_id,
           p.nickname::text,
           f.message,
           f.mode,
           f.difficulty,
           f.score,
           f.build,
           f.created_at,
           f.answer,
           f.answered_at,
           f.answer_seen_at
      from feedback f
      -- A message outlives its author: `feedback.user_id` is `on delete set null`, so a
      -- player who removed their profile does not retract what they told us. Left join,
      -- and the screen draws those rows as the anonymous ones they now are.
      left join profiles p on p.id = f.user_id
     order by f.created_at desc;
end;
$$;

-- How many messages are still owed an answer, and nothing else.
--
-- Its own function rather than a field of `admin_stats`, which also returns it: this one
-- is read by the **intro screen**, to put a dot on the ADMIN link, and that screen has no
-- business computing a fortnight of run figures to find out whether there is a dot. One
-- integer, one index scan.
create or replace function admin_feedback_owed()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_feedback_owed: not an admin';
  end if;
  return (select count(*) from feedback where answer is null);
end;
$$;

revoke all on function public.admin_feedback()      from public;
revoke all on function public.admin_feedback_owed() from public;
grant execute on function public.admin_feedback()      to authenticated;
grant execute on function public.admin_feedback_owed() to authenticated;
