-- `scores` becomes a rollup of `daily_scores`, maintained by the server.
--
-- The two tables were never independent: `scores` is the all-time best, and since
-- nothing prunes `daily_scores`, that is just the best day a player ever had on a
-- board. The client wrote both at once, which made the derived table something a
-- flaky connection could disagree with — a submit that landed in `scores` but not
-- `daily_scores` leaves an all-time record no day accounts for, and if that entry is
-- later retired the two stay out of step for good.
--
-- Now one write to `daily_scores` carries the other. Realtime still sees two events
-- per submit, which is what the board store's burst coalescing expects: the trigger's
-- write to `scores` is a change event of its own.
--
-- security definer so the rollup keeps working if the client's own grant on `scores`
-- is ever revoked — the intended hardening once nothing but this trigger writes it.
-- It can only ever write the row named by the daily row that fired it, and RLS on
-- `daily_scores` already restricts a player to their own.
create or replace function roll_up_daily_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into scores as s (user_id, mode, difficulty, best_score, hits, updated_at)
  values (new.user_id, new.mode, new.difficulty, new.best_score, new.hits, new.updated_at)
  on conflict (user_id, mode, difficulty) do update
    set best_score = excluded.best_score,
        hits       = excluded.hits,
        updated_at = excluded.updated_at
    -- Strictly better only. An equal score leaves the row alone so `updated_at` keeps
    -- the moment the best was first reached — the board sorts ties by it, and the
    -- leaderboard shows it as how long the record has stood.
    where excluded.best_score > s.best_score;
  return null;
end;
$$;

create trigger daily_scores_roll_up
  after insert or update on daily_scores
  for each row execute function roll_up_daily_score();

-- Reconcile anything that already drifted, and make the invariant true for history as
-- well as for what follows: every row in `scores` is the best day in `daily_scores`.
-- `distinct on` takes that day per board, oldest first among equal scores for the same
-- reason the trigger does.
insert into scores (user_id, mode, difficulty, best_score, hits, updated_at)
select distinct on (user_id, mode, difficulty)
       user_id, mode, difficulty, best_score, hits, updated_at
from   daily_scores
order  by user_id, mode, difficulty, best_score desc, updated_at asc
on conflict (user_id, mode, difficulty) do update
  set best_score = excluded.best_score,
      hits       = excluded.hits,
      updated_at = excluded.updated_at
  where excluded.best_score > scores.best_score;
