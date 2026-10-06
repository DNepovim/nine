-- The weekly recap — what last week on the boards came to, as facts.
--
-- One round trip for a week: who topped each of the six scored boards on each of its seven
-- days, and which all-time boards changed hands while it ran. The app turns that into two
-- or three sentences — see lib/recap.ts. Nothing here knows what a sentence is, and nothing
-- here is stored: a closed week is a function of tables that already hold every fact it
-- depends on, the same reasoning `my_winnings` is built on.
--
-- No new index. `daily_scores_board_day_idx` from the winnings migration is
-- (mode, difficulty, day, best_score desc, updated_at asc), which is exactly the order the
-- cell query below reads in.
--
-- Bounds are passed in, inclusive at both ends, as every closed-window function here takes
-- them: the app draws a week on the Prague clock in lib/leaderboard-period.ts, and a second
-- definition in SQL is a second thing to keep in step.

create or replace function weekly_recap(
  -- The Monday of the week being told, and its Sunday.
  p_from date,
  p_to   date
) returns table (
  -- 'cell' — a board somebody topped on a day. 'takeover' — an all-time board that changed
  -- hands inside the window. Two kinds in one result set rather than two round trips, the
  -- way `past_winners` returns its two windows.
  kind       text,
  mode       text,
  difficulty text,
  day        date,
  nickname   text
) language sql stable security definer set search_path = public as $$
  -- Who topped each board on each day of the window.
  --
  -- The winner rule is the one `past_winners` and `my_winnings` already encode: the highest
  -- score on the day, ties to whoever reached it first, no zeros — the first submit on a
  -- board writes a row regardless and an empty day would otherwise crown whoever touched it
  -- last — and no nickname, no board, so no win.
  --
  -- One `distinct on` over the whole window, not a lateral join per board per day. Six
  -- boards across seven days is forty-two of those, and the index above already delivers
  -- the rows in the order that makes one pass enough.
  with cells as (
    select distinct on (d.mode, d.difficulty, d.day)
           d.mode, d.difficulty, d.day, pr.nickname::text as nickname
    from   daily_scores d
    join   profiles pr on pr.id = d.user_id and pr.nickname is not null
    where  d.day between p_from and p_to
      and  d.best_score > 0
    order  by d.mode, d.difficulty, d.day, d.best_score desc, d.updated_at asc
  ),
  -- Who holds each all-time board right now. `scores` keeps one row per player per board —
  -- their own best — so the board's record is the top row of it, by the same rule the cells
  -- use one rung down.
  leaders as (
    select distinct on (s.mode, s.difficulty)
           s.mode, s.difficulty, pr.nickname::text as nickname, s.updated_at
    from   scores s
    join   profiles pr on pr.id = s.user_id and pr.nickname is not null
    where  s.best_score > 0
    order  by s.mode, s.difficulty, s.best_score desc, s.updated_at asc
  )
  select 'cell'::text, c.mode, c.difficulty, c.day, c.nickname
  from   cells c
  union all
  -- A takeover is a leader whose row moved inside the window: they did not hold this board
  -- when the week opened, and they do now.
  --
  -- What this cannot see, and the copy in lib/recap-lines.ts is written never to claim: a
  -- record taken on the Tuesday and beaten again on the Friday is one takeover rather than
  -- two, and one taken inside the window and then lost reads as never having happened.
  -- `scores` holds a current best, not a history, and a history table for one sentence is
  -- more than that sentence is worth.
  --
  -- The one place in this work SQL has to say when a Prague day turns. `daily_scores.day`
  -- is stamped by the client and needs no conversion; `scores.updated_at` is an instant and
  -- does. `at time zone` reads the IANA zone rather than re-deriving the rule, so this and
  -- lib/leaderboard-period.ts are still one rule written once in each language that needs it.
  select 'takeover'::text, l.mode, l.difficulty,
         (l.updated_at at time zone 'Europe/Prague')::date, l.nickname
  from   leaders l
  where  (l.updated_at at time zone 'Europe/Prague')::date between p_from and p_to;
$$;

grant execute on function public.weekly_recap(date, date) to anon, authenticated;
