-- Who is behind the six tiles at the top of the analytics screen.
--
-- `admin_stats` answers in counts and was written so that it could not do otherwise: no
-- shape in it can return a profile. `admin_stats_people` is the other half, asked for on
-- purpose — a tap on a tile opens the players that figure is made of — and it is a
-- function of its own so the screen's figures stay one call that names nobody, and this
-- is only ever read when somebody asks for a name.
--
-- **One definition behind both.** `admin_stats_rows` is the window's players, one row per
-- profile that joined in it or posted a run in it, with what the run tiles count for each.
-- The six window figures in `admin_stats` are now sums and counts over it, and the lists
-- are those same rows — so a tile and the list it opens cannot drift, whichever of them
-- somebody changes. The app's only part is which rows a tile means (`linesFor`), and every
-- one of those is a single column of this function.
--
-- The populations are the ones `admin_stats` already counted. **Joined** is every profile
-- created in the window, admins included. **Runs** leave out anybody holding `admin` — see
-- 20261016010000_stats_without_admins.sql for why. An admin who joined in the window is
-- therefore a row with no runs, which is exactly what the tiles say about them.

-- Internal: not granted to anybody. Both callers check `admin` themselves first.
create or replace function admin_stats_rows(p_from date, p_to date)
returns table (
  user_id    uuid,
  nickname   text,
  joined     boolean,
  runs       bigint,
  hits       bigint,
  elapsed_ms bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with admins as (
    -- The same set `admin_stats` reads, scoped the same way.
    select p.id
    from   profiles p
    where  (p.role is not null
            or exists (select 1 from user_features uf where uf.user_id = p.id))
      and  has_feature(p.id, 'admin')
  ),
  played as (
    select r.user_id,
           count(*)                       as runs,
           coalesce(sum(r.hits), 0)       as hits,
           coalesce(sum(r.elapsed_ms), 0) as elapsed_ms
    from   run_receipts r
    where  (r.at at time zone 'Europe/Prague')::date between p_from and p_to
      and  r.user_id not in (select id from admins)
    group  by r.user_id
  )
  select p.id,
         p.nickname,
         (p.created_at at time zone 'Europe/Prague')::date between p_from and p_to,
         coalesce(r.runs, 0),
         coalesce(r.hits, 0),
         coalesce(r.elapsed_ms, 0)::bigint
  from   profiles p
  left   join played r on r.user_id = p.id
  where  r.user_id is not null
     or  (p.created_at at time zone 'Europe/Prague')::date between p_from and p_to;
$$;

revoke all on function public.admin_stats_rows(date, date) from public, anon, authenticated;

create or replace function admin_stats_people(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not has_feature(auth.uid(), 'admin') then
    raise exception 'admin_stats_people: not an admin';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id',    w.user_id,
             'nickname',   w.nickname,
             'joined',     w.joined,
             'runs',       w.runs,
             'hits',       w.hits,
             -- Milliseconds, not minutes, so the app can sum and round exactly as the tile
             -- does rather than adding up figures already rounded.
             'elapsed_ms', w.elapsed_ms
           )), '[]'::jsonb)
    from admin_stats_rows(p_from, p_to) w
  );
end;
$$;

revoke all on function public.admin_stats_people(date, date) from public;
grant execute on function public.admin_stats_people(date, date) to authenticated;

-- `admin_stats` restated from 20261016010000 in full — Postgres replaces a body or
-- nothing — with its six window figures read from `admin_stats_rows`. Every other key is
-- that migration's text unchanged.
create or replace function admin_stats(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- Everybody the app would show these screens to, as an array read once.
  --
  -- Scoped to the roled population the way `guard_admin_floor` scopes it — only a profile
  -- with a role or an override of its own can possibly hold the feature — so this is a
  -- handful of rows rather than `has_feature` called once per receipt.
  v_admins uuid[];
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

  select coalesce(array_agg(p.id), '{}')
  into   v_admins
  from   profiles p
  where  (p.role is not null
          or exists (select 1 from user_features uf where uf.user_id = p.id))
    and  has_feature(p.id, 'admin');

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
        -- The window's two from `admin_stats_rows`, which the players behind the tiles are
        -- listed from: one definition of who joined, so the list cannot disagree.
        'joined',       (select count(*) from admin_stats_rows(p_from, p_to) w where w.joined),
        'joined_named', (select count(*) from admin_stats_rows(p_from, p_to) w
                          where w.joined and w.nickname is not null),
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
    --
    -- **Without the people who read this screen.** Every run figure below — this block,
    -- the daily bars and the breakdown by board — leaves out anybody holding `admin`,
    -- because a dozen test runs on a quiet day is a spike in the data about a day nobody
    -- else played. The figures about the *population* do not do this: an admin is a real
    -- profile and a real message, and leaving those out would make the counts disagree
    -- with the tables they are counted from.
    -- `players` is the distinct count over the same window, which is the only active-player
    -- figure this database can answer.
    'runs', (
      -- The window's four from `admin_stats_rows`, for the same reason as JOINED above.
      -- Only `before` still reads the receipts here: it is a different window, and nobody
      -- lists its players.
      select jsonb_build_object(
        'runs',    coalesce(sum(w.runs), 0),
        'players', count(*) filter (where w.runs > 0),
        'hits',    coalesce(sum(w.hits), 0),
        'minutes', round(coalesce(sum(w.elapsed_ms), 0) / 60000.0),
        'before',  (
          select count(*) from run_receipts
          where (at at time zone 'Europe/Prague')::date between v_prev_from and v_prev_to
            and user_id <> all(v_admins)
        )
      )
      from admin_stats_rows(p_from, p_to) w
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
        where user_id <> all(v_admins)
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
          and user_id <> all(v_admins)
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
    -- Four counts that each have a table to themselves and would not earn a block.
    --
    -- `feedback_owed` used to be a fifth and is gone. It counted every message with no
    -- answer, which stopped being the same question as *how many are owed* the day a
    -- message could be set aside unanswered — and the screen reads `admin_feedback_owed`
    -- for that figure anyway, which is the one definition of owed the app has. A key
    -- nobody reads is a key that will one day be read by mistake.
    'pulse', jsonb_build_object(
      'feedback', (
        select count(*) from feedback
        where (created_at at time zone 'Europe/Prague')::date between p_from and p_to
      ),
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

grant execute on function public.admin_stats(date, date) to authenticated;
