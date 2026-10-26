-- Assertions over session_scores: the window and its grace, the no-downgrade, the
-- ranking, the cancel refusal and who may read.
--
-- Run with `pnpm db:test`, which resets the local database first.
--
-- The window rule is the reason this file matters most. It lives in one `plpgsql`
-- branch and nothing else in the repo holds it: a client cannot be trusted to know
-- whether a session is still open, and a regression here would silently accept scores
-- into a contest that had already been settled.

do $$
declare
  v_a       uuid;
  v_b       uuid;
  v_open    uuid;
  v_shut    uuid;
  v_soon    uuid;
  v_grace   uuid;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles order by id offset 1 limit 1;
  -- The board drops a player with no nickname, so both fixtures need one.
  update profiles set nickname = 'TESTER_A' where id = v_a;
  update profiles set nickname = 'TESTER_B' where id = v_b;

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_open;
  -- Closed two minutes ago: still inside the ten-minute grace.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/grace', now() - interval '2 hours', now() - interval '2 minutes')
  returning id into v_grace;
  -- Closed an hour ago: well past it.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/shut', now() - interval '3 hours', now() - interval '1 hour')
  returning id into v_shut;
  -- Opens tomorrow.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/soon', now() + interval '1 day', now() + interval '2 days')
  returning id into v_soon;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);

  -- ── Inside the window ───────────────────────────────────────────────────────
  perform submit_session_score(v_open, 1200, 9, 'hard', now());
  assert (select best_score from session_scores where session_id = v_open and user_id = v_a) = 1200,
    'a score inside the window should be accepted';

  -- ── Inside the grace ────────────────────────────────────────────────────────
  -- A run that started before the close cannot be robbed by the clock. Ten minutes is
  -- longer than any run, so anything arriving inside it began in time.
  perform submit_session_score(v_grace, 900, 7, 'hard', now());
  assert (select count(*) from session_scores where session_id = v_grace) = 1,
    'a score inside the grace should be accepted';

  -- ── Past the grace ──────────────────────────────────────────────────────────
  begin
    perform submit_session_score(v_shut, 5000, 20, 'hard', now());
    assert false, 'a score past the grace should have been refused';
  exception when others then
    assert sqlerrm like '%has closed%', 'wrong error: ' || sqlerrm;
  end;

  -- ── Before it opens ─────────────────────────────────────────────────────────
  -- Not graced in the same direction: a run played before a session opens was not a run
  -- of that session at all.
  begin
    perform submit_session_score(v_soon, 5000, 20, 'hard', now());
    assert false, 'a score before the open should have been refused';
  exception when others then
    assert sqlerrm like '%has not opened%', 'wrong error: ' || sqlerrm;
  end;

  -- ── A session nobody has heard of ───────────────────────────────────────────
  begin
    perform submit_session_score(gen_random_uuid(), 100, 1, 'hard', now());
    assert false, 'a score for an unknown session should have been refused';
  exception when others then
    assert sqlerrm like '%no such session%', 'wrong error: ' || sqlerrm;
  end;

  -- ── No downgrade ────────────────────────────────────────────────────────────
  perform submit_session_score(v_open, 400, 3, 'hard', now());
  assert (select best_score from session_scores where session_id = v_open and user_id = v_a) = 1200,
    'a worse score should not have replaced a better one';
  perform submit_session_score(v_open, 1800, 12, 'hard', now());
  assert (select best_score from session_scores where session_id = v_open and user_id = v_a) = 1800,
    'a better score should have replaced it';

  -- ── One row per player per session ──────────────────────────────────────────
  assert (select count(*) from session_scores where session_id = v_open) = 1,
    'three submits by one player should be one row';

  raise notice 'session_scores.sql: the window and the no-downgrade OK';
end;
$$;

do $$
declare
  v_a uuid; v_b uuid; v_s uuid;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles order by id offset 1 limit 1;
  select id into v_s from challenge_sessions where mode_id = 'challenge/four-keys' limit 1;

  -- ── The ranking, and its tie-break ──────────────────────────────────────────
  -- B ties A's score but gets there later, so A keeps first. Every board in this app
  -- breaks ties by when the score was set, and the standings follow suit.
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_s, 1800, 12, 'hard', now() + interval '1 minute');

  assert (select user_id from session_board(v_s) where rank = 1) = v_a,
    'the earlier of two equal scores should rank first';
  assert (select count(*) from session_board(v_s)) = 2, 'both players should be listed';

  -- ── The card's one round trip ───────────────────────────────────────────────
  assert (select leader_name from open_sessions_with_leaders() where id = v_s) = 'TESTER_A',
    'the card should name whoever leads';
  assert (select leader_score from open_sessions_with_leaders() where id = v_s) = 1800,
    'the card should carry the leading score';
  -- A session nobody has played comes back with a null leader rather than not at all:
  -- the card still has a challenge and a countdown to draw.
  assert exists (
    select 1 from open_sessions_with_leaders()
     where mode_id = 'challenge/soon' and leader_name is null),
    'an unplayed session should still be listed, with no leader';
  -- And one that has closed is not offered at all.
  assert not exists (
    select 1 from open_sessions_with_leaders() where mode_id = 'challenge/shut'),
    'a closed session should not be offered to the card';

  raise notice 'session_scores.sql: the ranking and the card read OK';
end;
$$;

do $$
declare
  v_admin uuid; v_played uuid; v_empty uuid;
begin
  select id into v_admin from profiles order by id limit 1;
  update profiles set role = 'admin' where id = v_admin;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  select id into v_played from challenge_sessions where mode_id = 'challenge/four-keys' limit 1;
  select id into v_empty  from challenge_sessions where mode_id = 'challenge/soon' limit 1;

  -- ── Cancelling a session people have played ─────────────────────────────────
  -- Phase one made cancel unconditional; from here the rows underneath are scores, and
  -- the one door an admin reaches through refuses rather than cascading them away.
  begin
    perform cancel_challenge_session(v_played);
    assert false, 'cancelling a session with scores should have been refused';
  exception when others then
    assert sqlerrm like '%already scored on it%', 'wrong error: ' || sqlerrm;
  end;
  assert (select count(*) from session_scores where session_id = v_played) = 2,
    'the refused cancel should have left the standings alone';

  -- ── A session nobody has played is still free to go ─────────────────────────
  perform cancel_challenge_session(v_empty);
  assert (select count(*) from challenge_sessions where id = v_empty) = 0,
    'cancelling an unplayed session should still work';

  -- ── The cascade is still the shape of the data ──────────────────────────────
  -- Standings may never outlive the session they belong to. The RPC is what stops an
  -- admin reaching it; a delete by any other route still takes them.
  delete from challenge_sessions where id = v_played;
  assert (select count(*) from session_scores where session_id = v_played) = 0,
    'deleting a session should take its standings with it';

  raise notice 'session_scores.sql: the cancel guard and the cascade OK';
end;
$$;

-- ── Who may read, and who may not write ───────────────────────────────────────
do $$
declare v_s uuid; v_u uuid;
begin
  select id into v_u from profiles order by id limit 1;
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/readable', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_s;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_s, v_u, 500, 4, 'hard', now());
end;
$$;

-- `set role`, not `set local role`: psql runs each statement in its own transaction, so
-- a LOCAL setting is reverted before the next statement sees it.
set role anon;
do $$
begin
  assert (select count(*) from session_scores) >= 1, 'anon should be able to read standings';

  begin
    insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
    select session_id, user_id, 99999, 1, 'hard', now() from session_scores limit 1;
    assert false, 'anon should not be able to write a score directly';
  exception when insufficient_privilege then null;
  end;

  -- The write path is the RPC, and it refuses a caller with no session.
  begin
    perform submit_session_score(gen_random_uuid(), 100, 1, 'hard', now());
    assert false, 'an unauthenticated caller should not be able to submit';
  exception when others then
    assert sqlerrm like '%not authenticated%' or sqlerrm like '%no such session%',
      'wrong error: ' || sqlerrm;
  end;

  raise notice 'session_scores.sql: read policy OK';
end;
$$;
reset role;

delete from session_scores;
delete from challenge_sessions;
update profiles set nickname = null where nickname in ('TESTER_A', 'TESTER_B');
update profiles set role = null where role = 'admin';

-- ── Editing a session people have played ──────────────────────────────────────
-- The other half of the cancel guard. `session_scores` rows carry no mode of their own,
-- so re-pointing a played session makes somebody's run part of a different contest.
do $$
declare v_admin uuid; v_u uuid; v_s uuid;
begin
  select id into v_admin from profiles order by id limit 1;
  select id into v_u     from profiles order by id offset 1 limit 1;
  update profiles set role = 'admin' where id = v_admin;
  update profiles set nickname = 'EDITOR' where id = v_u;

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/edit-me', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_s;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- Untouched: the challenge may still be corrected.
  perform edit_challenge_session(v_s, 'challenge/edit-you', now() - interval '1 hour',
                                 now() + interval '1 hour');
  assert (select mode_id from challenge_sessions where id = v_s) = 'challenge/edit-you',
    'an unplayed session should still be re-pointable';

  -- Played: it may not.
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);
  perform submit_session_score(v_s, 700, 5, 'hard', now());
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  begin
    perform edit_challenge_session(v_s, 'challenge/somewhere-else',
                                   now() - interval '1 hour', now() + interval '1 hour');
    assert false, 'changing the challenge of a played session should have been refused';
  exception when others then
    assert sqlerrm like '%cannot change challenge%', 'wrong error: ' || sqlerrm;
  end;
  assert (select mode_id from challenge_sessions where id = v_s) = 'challenge/edit-you',
    'the refused edit should have left the session alone';

  -- And the span no longer moves either, which changed on 2026-10-16: this used to be
  -- the ordinary reason to open the form, and the assertion below used to be its mirror
  -- image. A board is a contest people have run in, so moving the window afterwards
  -- changes what they were playing — EXTEND is the one way a played window still moves,
  -- and it only ever adds time to the end. See 20261016020000_session_controls.sql.
  begin
    perform edit_challenge_session(v_s, 'challenge/edit-you', now() - interval '2 hours',
                                   now() + interval '3 hours');
    assert false, 'moving a played session''s span should have been refused';
  exception when others then
    assert sqlerrm like '%window cannot be moved%', 'wrong error: ' || sqlerrm;
  end;
  assert (select closes_at from challenge_sessions where id = v_s) < now() + interval '2 hours',
    'the refused edit should have left the span alone';

  -- An identical save is still a no-op rather than a refusal: the guard is about a
  -- rewrite, not about the form being opened.
  perform edit_challenge_session(v_s, 'challenge/edit-you', now() - interval '1 hour',
                                 now() + interval '1 hour');

  raise notice 'session_scores.sql: the edit guard OK';

  delete from challenge_sessions where id = v_s;
  update profiles set role = null where id = v_admin;
  update profiles set nickname = null where id = v_u;
end;
$$;

-- ─── The measure ─────────────────────────────────────────────────────────────
--
-- A session board ordered by the clock rather than the score, and the keep-better rule
-- that has to follow it. The thing this guards is a silent one: before the measure, a
-- player who ran *faster but scored less* had their better time refused by the shared
-- no-downgrade trigger, with nothing anywhere saying so.
do $$
declare
  v_a     uuid;
  v_b     uuid;
  v_race  uuid;
  v_plain uuid;
  v_rank  bigint;
  v_time  int;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles where id <> v_a order by id limit 1;
  update profiles set nickname = 'RACER_A' where id = v_a;
  update profiles set nickname = 'RACER_B' where id = v_b;

  insert into challenge_sessions (mode_id, opens_at, closes_at, measure)
  values ('challenge/habit', now() - interval '1 hour',
          now() + interval '1 hour', 'time')
  returning id into v_race;

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', now() - interval '1 hour',
          now() + interval '1 hour')
  returning id into v_plain;

  -- A session booked without a measure is a score one, which is what every row already
  -- in the table is.
  assert (select measure from challenge_sessions where id = v_plain) = 'score',
    'a session should be measured by its score unless it says otherwise';

  -- ── The five-argument call still works ──
  --
  -- Every app already in players' hands calls this with five. If the default on the
  -- sixth were ever dropped, those builds would stop posting session scores the moment
  -- the migration landed, and they would do it quietly.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_plain, 500, 4, 'hard', now());
  assert (select time_ms from session_scores
           where session_id = v_plain and user_id = v_a) is null,
    'a five-argument submission should record no time';

  -- ── Ordered by the clock ──
  perform submit_session_score(v_race, 900, 9, 'hard', now(), 14000);
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_race, 400, 9, 'hard', now(), 11000);

  select rank into v_rank from session_board(v_race) where user_id = v_b;
  assert v_rank = 1,
    'the faster run should lead a time-measured session however it scored';
  select rank into v_rank from session_board(v_race) where user_id = v_a;
  assert v_rank = 2, 'the slower run should be second on a time-measured session';

  -- The same two scores on a score-measured session rank the other way round, which is
  -- what says the order is the measure's doing rather than the data's.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_plain, 900, 9, 'hard', now());
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_plain, 400, 9, 'hard', now());
  select rank into v_rank from session_board(v_plain) where user_id = v_a;
  assert v_rank = 1, 'the higher score should lead a score-measured session';

  -- ── Faster but worse-scoring replaces the held row ──
  --
  -- The whole reason `prevent_session_downgrade` exists. The shared
  -- `prevent_score_downgrade` reads the score and nothing else, so it would refuse this
  -- write and the player's better time would never appear.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_race, 100, 9, 'hard', now(), 9000);
  select time_ms into v_time from session_scores
    where session_id = v_race and user_id = v_a;
  assert v_time = 9000,
    'a faster run should replace a slower one even when it scored less';

  -- And a slower run never does, whatever it scored.
  perform submit_session_score(v_race, 5000, 9, 'hard', now(), 20000);
  select time_ms into v_time from session_scores
    where session_id = v_race and user_id = v_a;
  assert v_time = 9000, 'a slower run should not replace a faster one';
  assert (select best_score from session_scores
           where session_id = v_race and user_id = v_a) = 100,
    'the refused run should have left the whole row alone, not just its time';

  -- ── The score rule is untouched where there is no time ──
  perform submit_session_score(v_plain, 10, 1, 'hard', now());
  assert (select best_score from session_scores
           where session_id = v_plain and user_id = v_a) = 900,
    'a worse score should still be refused on a score-measured session';

  -- ── The card names the leader by the measure ──
  -- A improved to 9000ms above, which is why the leader is no longer B: the card names
  -- whoever is fastest *now*, not whoever led when they arrived.
  assert (select leader_name from open_sessions_with_leaders() where id = v_race)
         = 'RACER_A',
    'the card should name the fastest player on a race';
  assert (select leader_name from open_sessions_with_leaders() where id = v_plain)
         = 'RACER_A',
    'the card should name the highest-scoring player on a score-measured session';

  raise notice 'session_scores.sql: the measure OK';

  delete from challenge_sessions where id in (v_race, v_plain);
  update profiles set nickname = null where id in (v_a, v_b);
end;
$$;

-- ─── Measured by hits ────────────────────────────────────────────────────────
--
-- NO SLIP's standings: the run that lasted longer leads whatever it scored, and two runs
-- that lasted as long are told apart by the score. The keep-better rule has to follow,
-- or a long run's row would be replaced by a short one that happened to score more.
do $$
declare
  v_a    uuid;
  v_b    uuid;
  v_c    uuid;
  v_hits uuid;
  v_rank bigint;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles where id <> v_a order by id limit 1;
  select id into v_c from profiles where id not in (v_a, v_b) order by id limit 1;
  update profiles set nickname = 'SLIP_A' where id = v_a;
  update profiles set nickname = 'SLIP_B' where id = v_b;
  update profiles set nickname = 'SLIP_C' where id = v_c;

  insert into challenge_sessions (mode_id, opens_at, closes_at, measure)
  values ('challenge/no-slip', now() - interval '1 hour', now() + interval '1 hour', 'hits')
  returning id into v_hits;

  -- ── Ordered by hits, then the score ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_hits, 500, 7, 'easy', now());
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_hits, 900, 5, 'easy', now());
  perform set_config('request.jwt.claims', json_build_object('sub', v_c)::text, true);
  perform submit_session_score(v_hits, 600, 7, 'easy', now());

  select rank into v_rank from session_board(v_hits) where user_id = v_c;
  assert v_rank = 1, 'equal hits should go to the higher score';
  select rank into v_rank from session_board(v_hits) where user_id = v_a;
  assert v_rank = 2, 'more hits should beat a higher score';
  select rank into v_rank from session_board(v_hits) where user_id = v_b;
  assert v_rank = 3, 'fewer hits should place last whatever they scored';
  assert (select leader_name from open_sessions_with_leaders() where id = v_hits)
         = 'SLIP_C',
    'the card should name the player with the most hits';
  assert (select leader_hits from open_sessions_with_leaders() where id = v_hits) = 7,
    'the card should carry the leader''s hits';

  -- ── Keeping the better row ──
  -- A shorter run scoring more is refused; the whole row stays.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_hits, 2000, 5, 'easy', now());
  assert (select hits from session_scores where session_id = v_hits and user_id = v_a) = 7,
    'a run with fewer hits should not replace one with more, whatever it scored';
  assert (select best_score from session_scores
           where session_id = v_hits and user_id = v_a) = 500,
    'the refused run should have left the whole row alone';

  -- As long, scoring more, replaces it.
  perform submit_session_score(v_hits, 800, 7, 'easy', now());
  assert (select best_score from session_scores
           where session_id = v_hits and user_id = v_a) = 800,
    'an equally long run scoring more should replace the held row';

  -- As long, scoring less, does not.
  perform submit_session_score(v_hits, 100, 7, 'easy', now());
  assert (select best_score from session_scores
           where session_id = v_hits and user_id = v_a) = 800,
    'an equally long run scoring less should be refused';

  -- Longer, scoring less, does.
  perform submit_session_score(v_hits, 300, 9, 'easy', now());
  assert (select hits from session_scores where session_id = v_hits and user_id = v_a) = 9,
    'a run with more hits should replace the held row even when it scored less';

  raise notice 'session_scores.sql: measured by hits OK';

  delete from challenge_sessions where id = v_hits;
  update profiles set nickname = null where id in (v_a, v_b, v_c);
end;
$$;

-- ─── The summary a closed session leaves behind ──────────────────────────────
--
-- `my_session_summaries` answers for one caller and no other, which is the whole of its
-- access rule: there is no `p_user_id` to get wrong because eligibility *is* having a
-- `session_scores` row, and the row is found through `auth.uid()`. The three assertions
-- below are the three ways that could stop being true — a session leaking to somebody
-- who never played it, a player's own session going missing, and the floor that stops a
-- client asking about the epoch from pulling a year of podiums.
do $$
declare
  v_a     uuid;
  v_b     uuid;
  v_mine  uuid;
  v_other uuid;
  v_old    uuid;
  v_live   uuid;
  v_row    record;
  v_closed timestamptz;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles order by id offset 1 limit 1;
  update profiles set nickname = 'SUMMER_A' where id = v_a;
  update profiles set nickname = 'SUMMER_B' where id = v_b;

  -- Shut an hour ago, and A played it.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/mine', now() - interval '3 hours', now() - interval '1 hour')
  returning id into v_mine;
  -- Shut an hour ago, and only B played it.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/other', now() - interval '3 hours', now() - interval '1 hour')
  returning id into v_other;
  -- Shut forty days ago, and A played it. Past the floor.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/old', now() - interval '41 days', now() - interval '40 days')
  returning id into v_old;
  -- Still open, and A is playing it. Not a summary yet.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/live', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_live;

  -- The rows are written straight rather than through `submit_session_score`, which
  -- refuses a shut window — that refusal is what the top of this file asserts, and these
  -- fixtures need the rows it would not let through.
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_mine,  v_a, 1500, 9, 'hard', now() - interval '2 hours'),
         (v_mine,  v_b, 2500, 9, 'hard', now() - interval '2 hours'),
         (v_other, v_b, 700,  5, 'hard', now() - interval '2 hours'),
         (v_old,   v_a, 400,  4, 'hard', now() - interval '40 days'),
         (v_live,  v_a, 100,  2, 'hard', now());

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);

  -- ── Only what this player played, and only what has shut ────────────────────
  assert (select count(*) from my_session_summaries(now() - interval '1 day')) = 1,
    'a summary should be owed for the one shut session this player scored on';
  assert (select id from my_session_summaries(now() - interval '1 day')) = v_mine,
    'the session returned should be the one this player played';

  -- ── The podium, and where this player came on it ────────────────────────────
  select * into v_row from my_session_summaries(now() - interval '1 day');
  assert v_row.players = 2, 'players should count the whole board, not the podium';
  assert (v_row.places -> 0 ->> 'nickname') = 'SUMMER_B',
    'the podium should be ranked by the measure, best first';
  assert (v_row.mine ->> 'rank') = '2',  'this player came second';
  assert (v_row.mine ->> 'score') = '1500', 'and their own figure rides along';

  -- ── The floor ───────────────────────────────────────────────────────────────
  assert (select count(*) from my_session_summaries('epoch'::timestamptz)) = 1,
    'a client asking about the epoch should still not reach past the thirty-day floor';

  -- ── Somebody else's contest ─────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  assert (select count(*) from my_session_summaries(now() - interval '1 day')) = 2,
    'B played both shut sessions and is owed both';
  assert not exists (
    select 1 from my_session_summaries(now() - interval '1 day') where id = v_live
  ), 'a session still open is never a summary';

  -- ── Told once, and once means once ──────────────────────────────────────────
  --
  -- The client's clock is milliseconds and this column is microseconds, so a watermark
  -- taken from `closes_at` is that instant *floored*. Handed back as `p_since`, an
  -- untruncated `closes_at` is strictly greater than it — and the session is offered
  -- again, on every launch, forever. The truncation in the function is what closes that
  -- gap, and this is the assertion that keeps it closed.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  select closes_at into v_closed from my_session_summaries(now() - interval '1 day');
  assert v_closed = date_trunc('milliseconds', v_closed),
    'a summary should report its close in whole milliseconds, the unit the client stores';
  assert not exists (
    select 1 from my_session_summaries(v_closed) where id = v_mine
  ), 'a summary already told must not come back when its own close is the watermark';

  raise notice 'session_scores.sql: the summary OK';

  delete from challenge_sessions where id in (v_mine, v_other, v_old, v_live);
  update profiles set nickname = null where id in (v_a, v_b);
end;
$$;

-- ─── What a session podium pays into a fortune ───────────────────────────────
--
-- Three rules, and losing any of them is a silent money bug. The **shares** are the whole
-- feature: a fifth for third, where a board's podium pays a tenth. The **watermark** is
-- what keeps every fortune already earned exactly where it is — without it, every past
-- winner's figure jumps the day this ships. And a **live** session pays nothing, because
-- its standings can still move and a fortune reckoned from one would wobble under the
-- player.
do $$
declare
  v_a     uuid;
  v_b     uuid;
  v_c     uuid;
  v_paid  uuid;
  v_early uuid;
  v_live   uuid;
  v_graced uuid;
  v_base  bigint;
  v_bonus bigint;
  v_total bigint;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles where id <> v_a order by id limit 1;
  select id into v_c from profiles where id not in (v_a, v_b) order by id limit 1;
  update profiles set nickname = 'PODIUM_A' where id = v_a;
  update profiles set nickname = 'PODIUM_B' where id = v_b;
  update profiles set nickname = 'PODIUM_C' where id = v_c;

  -- Closed after the watermark: pays.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', session_podium_from() + interval '1 hour',
          session_podium_from() + interval '2 hours')
  returning id into v_paid;
  -- Closed before it: pays nothing, whatever place it was taken with.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/habit', session_podium_from() - interval '2 days',
          session_podium_from() - interval '1 day')
  returning id into v_early;
  -- Still open: pays nothing yet.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-by-four', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_live;

  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_paid,  v_a, 1000, 9, 'hard', session_podium_from() + interval '90 minutes'),
         (v_paid,  v_b,  800, 8, 'hard', session_podium_from() + interval '90 minutes'),
         (v_paid,  v_c,  600, 7, 'hard', session_podium_from() + interval '90 minutes'),
         (v_early, v_a, 5000, 9, 'hard', session_podium_from() - interval '36 hours'),
         (v_live,  v_a,  400, 4, 'hard', now());

  -- ── The shares ──────────────────────────────────────────────────────────────
  assert session_podium_bonus(v_paid, v_a) = 1000,
    'first should be paid their score again, got ' || session_podium_bonus(v_paid, v_a);
  assert session_podium_bonus(v_paid, v_b) = 400,
    'second should be paid half, got ' || session_podium_bonus(v_paid, v_b);
  assert session_podium_bonus(v_paid, v_c) = 120,
    'third should be paid a fifth, got ' || session_podium_bonus(v_paid, v_c);

  -- ── The watermark, the open window, and the grace ───────────────────────────
  assert session_podium_bonus(v_early, v_a) = 0,
    'a session that closed before the watermark must pay nothing';
  assert session_podium_bonus(v_live, v_a) = 0,
    'a session still open must pay nothing — its standings can still move';

  -- A fortune only ever grows, and this is the assertion that holds it to that. A score
  -- is still accepted for ten minutes after a window shuts, so inside that span a rival
  -- can push a player off a step — paying before it is out meant halving what somebody
  -- had already been paid.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/habit', now() - interval '2 hours', now() - interval '2 minutes')
  returning id into v_graced;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_graced, v_a, 1000, 9, 'hard', now() - interval '30 minutes');
  assert session_podium_bonus(v_graced, v_a) = 0,
    'a session still inside its ten-minute grace must pay nothing yet';

  -- And the moment the grace is out, the same place pays.
  update challenge_sessions set closes_at = now() - interval '11 minutes'
  where id = v_graced;
  assert session_podium_bonus(v_graced, v_a) = 1000,
    'once the grace is out the place pays, got ' || session_podium_bonus(v_graced, v_a);
  delete from challenge_sessions where id = v_graced;

  -- ── Off the podium ──────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  select v_paid, p.id, 10, 1, 'hard', session_podium_from() + interval '95 minutes'
  from   profiles p where p.id not in (v_a, v_b, v_c) and p.nickname is not null limit 1;
  assert (select coalesce(sum(session_podium_bonus(session_id, user_id)), 0)
          from session_scores where session_id = v_paid) = 1520,
    'nothing below third should add to the podium''s total';

  -- ── And it is what the fortune actually receives ────────────────────────────
  select sum(best_score), sum(session_podium_bonus(session_id, user_id))
    into v_base, v_bonus
  from session_scores where user_id = v_a and difficulty = 'hard';
  select (elem ->> 'scoreSum')::bigint into v_total
  from json_array_elements(
         player_profile(v_a, current_date, current_date - 7)::json -> 'sessionTotals'
       ) elem
  where elem ->> 'difficulty' = 'hard';
  assert v_total = v_base + v_bonus,
    'the profile should pay the points and the places, got ' || v_total
    || ' for ' || v_base || ' + ' || v_bonus;

  raise notice 'session_scores.sql: the podium bonus OK';

  delete from challenge_sessions where id in (v_paid, v_early, v_live);
  update profiles set nickname = null where id in (v_a, v_b, v_c);
end;
$$;
