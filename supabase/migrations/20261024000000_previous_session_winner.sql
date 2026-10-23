-- Who won this challenge the last time it was aired, for the third cell on a session
-- run's score bar.
--
-- The **same challenge**, not the last session of any: `last_session_winner` answers
-- that one, for the mark a player wears across the app. This answers a narrower question
-- a run is asking — what is there to beat on this drill's predecessor — so it is keyed by
-- the session the run belongs to and walks back through that session's `mode_id` only.
--
-- **Before this session opened, and settled.** Only an airing that shut before this one
-- opened is its predecessor, so a second session booked alongside is never mistaken for
-- one. And the latest airing that has a winner is the answer even while it is still in
-- its grace — in which case the answer is *nothing yet*, not the airing before it: a run
-- must never read a winner who could still be overtaken, nor one two airings stale.
--
-- **A session nobody scored on is walked past**, for the reason `last_session_winner`
-- gives: a contest nobody entered is not a result. No row at all is the first airing of
-- this challenge, and the strip draws nothing.
--
-- Ordered by `session_board`'s own rank, so a race's winner is its fastest finisher and
-- every other challenge's is its top score — the session's **measure** decides, as it
-- does everywhere a session is ranked.
create or replace function previous_session_winner(p_session_id uuid)
returns table (
  user_id     uuid,
  nickname    text,
  best_score  int,
  time_ms     int,
  avg_acc     int,
  avg_spd     int
) language sql stable security definer set search_path = public as $$
  select last.user_id, last.nickname, last.best_score, last.time_ms,
         last.avg_acc, last.avg_spd
  from (
    select winner.*, prev.closes_at
    from   challenge_sessions this
    join   challenge_sessions prev
      on   prev.mode_id = this.mode_id
     and   prev.id <> this.id
     and   prev.closes_at <= this.opens_at
    cross join lateral (
             select b.user_id, b.nickname, b.best_score, b.time_ms, b.avg_acc, b.avg_spd
             from   session_board(prev.id) b
             order  by b.rank
             limit  1
           ) winner
    where  this.id = p_session_id
    order  by prev.closes_at desc
    limit  1
  ) last
  where now() >= last.closes_at + session_score_grace();
$$;

-- Public, like `session_board` it reads: the strip draws it for whoever is playing,
-- signed in or not.
grant execute on function public.previous_session_winner(uuid) to anon, authenticated;
