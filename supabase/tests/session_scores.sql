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

  -- But the span still moves, which is the ordinary reason to open the form.
  perform edit_challenge_session(v_s, 'challenge/edit-you', now() - interval '2 hours',
                                 now() + interval '3 hours');
  assert (select closes_at from challenge_sessions where id = v_s) > now() + interval '2 hours',
    'the span of a played session should still be editable';

  raise notice 'session_scores.sql: the edit guard OK';

  delete from challenge_sessions where id = v_s;
  update profiles set role = null where id = v_admin;
  update profiles set nickname = null where id = v_u;
end;
$$;
