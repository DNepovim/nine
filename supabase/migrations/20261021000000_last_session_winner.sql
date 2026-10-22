-- Who took the last challenge, for the mark they wear until somebody takes the next one.
--
-- A **champion** wears their mark for holding a board right now; this is the same kind of
-- thing one rung down — a standing rather than a thing kept — but about a **session**
-- instead of a board. `championMark` already draws a crown or a bird in front of a name
-- wherever that name appears, and this rides beside it: a player can hold both Extreme
-- boards *and* have taken yesterday's challenge, and both are true at once.
--
-- **There is no expiry, and that is the rule rather than an omission.** The mark belongs
-- to whoever won the most recently closed session, so the next session closing moves it
-- without anything having to count down. "Until the next one ends" falls out of the
-- question instead of needing a clock — and the case nobody had decided, what happens when
-- no next session is booked, stops existing: the last winner keeps it, which is the honest
-- answer to "who won the last challenge".
--
-- **Past the grace**, for the reason `session_podium_bonus` waits too: a score is still
-- accepted for ten minutes after a window shuts, so the standings are not settled until it
-- is out. Marking somebody the winner and then taking it off them ten minutes later would
-- be the one thing worse than marking nobody.
--
-- **A session nobody scored on does not clear the mark.** The `cross join lateral` drops a
-- session with no board rather than returning a null for it, so the search walks on to the
-- last session somebody actually won. A contest nobody entered is not a result, and it
-- should not quietly unmark the player who won the one before.
create or replace function last_session_winner()
returns uuid language sql stable security definer set search_path = public as $$
  select winner.user_id
  from   challenge_sessions s
  cross join lateral (
           select b.user_id
           from   session_board(s.id) b
           order  by b.rank
           limit  1
         ) winner
  where  now() >= s.closes_at + session_score_grace()
  order  by s.closes_at desc
  limit  1;
$$;

-- Public, like the boards the other marks are read off: a mark in front of a name is
-- drawn for everyone who can see the name, and that includes a player who has not signed
-- in yet.
grant execute on function public.last_session_winner() to anon, authenticated;
