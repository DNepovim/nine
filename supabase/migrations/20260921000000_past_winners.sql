-- Who took a board in a window that has already closed: yesterday, and the week before
-- this one. Both sentences of the intro screen's winners stripe, in one round trip.
--
-- The `leaderboard` RPC cannot answer this. It bounds a period from below only —
-- everything since a date — which is right for TODAY and THIS WEEK, boards that are
-- still being played into, and wrong for a window that has closed at both ends.
--
-- Only rank one is returned, and only the row that holds it, because the board's rank
-- one is exactly that row: a period board takes each player's best day in the window
-- and ranks those, so the highest single day in the window belongs to whoever leads it.
-- No aggregation needed to find the top of an aggregate.
--
-- The window boundaries are passed in for the same reason `my_medals` takes its own:
-- the app draws them on the Prague clock (see lib/leaderboard-period.ts), and a second
-- definition in SQL is a second thing to keep in step.
--
-- `period` rather than `window` — the latter is a reserved word in Postgres, and it
-- matches what `my_medals` already calls this column.

create or replace function past_winners(
  p_mode       text,
  p_difficulty text,
  p_yesterday  date,
  p_week_from  date,
  p_week_to    date
) returns table (
  period     text,
  user_id    uuid,
  nickname   text,
  best_score int
) language sql stable security definer as $$
  with windows (period, from_day, to_day) as (
    values ('yesterday'::text, p_yesterday, p_yesterday),
           ('last_week',       p_week_from, p_week_to)
  )
  select w.period, top.user_id, top.nickname, top.best_score
  from windows w
  -- One row per window, or none where nobody played it — a window with no winner
  -- drops out here rather than coming back as a null the client has to read around.
  join lateral (
    select d.user_id, pr.nickname::text as nickname, d.best_score
    from   daily_scores d
    -- A player without a nickname is not on the board at all, so they cannot have won
    -- it either. Same rule as `leaderboard` and `my_medals`.
    join   profiles pr on pr.id = d.user_id and pr.nickname is not null
    where  d.mode = p_mode
      and  d.difficulty = p_difficulty
      and  d.day between w.from_day and w.to_day
      -- A zero is not a result. The first submit on a board writes a row regardless,
      -- and an empty window would otherwise crown whoever touched it last.
      and  d.best_score > 0
    -- Ties go to whoever reached the score first, which is how every board in the app
    -- breaks them.
    order  by d.best_score desc, d.updated_at asc
    limit  1
  ) top on true;
$$;

grant execute on function public.past_winners(text, text, date, date, date) to anon, authenticated;
