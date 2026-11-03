-- Assertions over session_ratings: who may rate, what a rating may be, and that a second
-- answer replaces the first.
--
-- Run with `pnpm db:test`, which resets the local database first.

do $$
declare
  v_a    uuid;
  v_b    uuid;
  v_shut uuid;
  v_open uuid;
  v_again uuid;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles order by id offset 1 limit 1;

  -- Closed five minutes ago: inside the grace, so the score below is still taken.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/rated', now() - interval '2 hours', now() - interval '5 minutes')
  returning id into v_shut;

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/still-on', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_open;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_shut, 800, 6, 'hard', now());
  perform submit_session_score(v_open, 500, 4, 'hard', now());

  -- ── A session still running ─────────────────────────────────────────────────
  -- A score on it, but no summary yet, so nothing to have been asked.
  begin
    perform rate_session(v_open, 5);
    assert false, 'a session still open should not take a rating';
  exception when others then
    assert sqlerrm like '%not closed%', 'wrong error: ' || sqlerrm;
  end;

  -- ── A player who played it ──────────────────────────────────────────────────
  perform rate_session(v_shut, 7);
  assert (select rating from session_ratings where session_id = v_shut and user_id = v_a) = 7,
    'a player with a score should be able to rate';

  -- ── A second answer replaces the first ──────────────────────────────────────
  perform rate_session(v_shut, 3);
  assert (select count(*) from session_ratings where session_id = v_shut) = 1,
    'a second rating should overwrite, not add';
  assert (select rating from session_ratings where session_id = v_shut and user_id = v_a) = 3,
    'the latest rating should be the one kept';

  -- ── Out of range ────────────────────────────────────────────────────────────
  begin
    perform rate_session(v_shut, 0);
    assert false, 'a rating of 0 should have been refused';
  exception when others then
    assert sqlerrm like '%1 to 9%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform rate_session(v_shut, 10);
    assert false, 'a rating of 10 should have been refused';
  exception when others then
    assert sqlerrm like '%1 to 9%', 'wrong error: ' || sqlerrm;
  end;

  -- ── A player who never played it ────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  begin
    perform rate_session(v_shut, 9);
    assert false, 'a player with no score should have been refused';
  exception when others then
    assert sqlerrm like '%no score%', 'wrong error: ' || sqlerrm;
  end;

  -- ── The lab's read: per challenge, admins only ───────────────────────────────
  -- A second airing of the same challenge, rated 9 by the other player, joins v_a's 3 on
  -- v_shut in one figure — and the open session, rated by nobody, has no row at all.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/rated', now() - interval '3 hours', now() - interval '4 minutes')
  returning id into v_again;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_again, 600, 5, 'hard', now());
  perform rate_session(v_again, 9);

  -- v_b holds no admin: refused.
  begin
    perform challenge_ratings();
    assert false, 'a non-admin should not read the ratings';
  exception when others then
    assert sqlerrm not like '%should not read%', 'wrong error: ' || sqlerrm;
  end;

  update profiles set role = 'admin' where id = v_b;
  assert (select ratings from challenge_ratings() where mode_id = 'challenge/rated') = 2,
    'both airings should count towards one challenge';
  assert (select average from challenge_ratings() where mode_id = 'challenge/rated') = 6.0,
    'the average should be over every rating of the challenge';
  assert not exists (select 1 from challenge_ratings() where mode_id = 'challenge/still-on'),
    'a challenge nobody rated should have no row';
  update profiles set role = null where id = v_b;

  raise notice 'session_ratings.sql: OK';

  delete from challenge_sessions where id in (v_shut, v_open, v_again);
end;
$$;

-- ─── The remark: the rating's written half ───────────────────────────────────
do $$
declare
  v_a     uuid;
  v_b     uuid;
  v_shut  uuid;
  v_open  uuid;
  v_race  uuid;
  v_empty uuid;
begin
  select id into v_a from profiles order by id limit 1;
  select id into v_b from profiles order by id offset 1 limit 1;
  update profiles set nickname = 'REMARKER' where id = v_a and nickname is null;
  update profiles set nickname = 'QUIET' where id = v_b and nickname is null;

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/remarked', now() - interval '2 hours', now() - interval '5 minutes')
  returning id into v_shut;
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/remarked', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_open;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_shut, 800, 6, 'hard', now());
  perform submit_session_score(v_open, 500, 4, 'hard', now());

  -- ── Words after a figure keep the figure; a figure after words keeps the words ──
  perform rate_session(v_shut, 4);
  perform remark_session(v_shut, '  too fast for me  ');
  assert (select rating from session_ratings where session_id = v_shut and user_id = v_a) = 4,
    'a remark should not touch the figure';
  assert (select remark from session_ratings where session_id = v_shut and user_id = v_a)
         = 'too fast for me', 'a remark should be stored trimmed';
  perform rate_session(v_shut, 5);
  assert (select remark from session_ratings where session_id = v_shut and user_id = v_a)
         = 'too fast for me', 'a later figure should not touch the remark';

  -- ── Refusals, in rate_session's words ───────────────────────────────────────
  begin
    perform remark_session(v_open, 'still on');
    assert false, 'a session still open should not take a remark';
  exception when others then
    assert sqlerrm like '%not closed%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform remark_session(v_shut, '   ');
    assert false, 'a blank remark should have been refused';
  exception when others then
    assert sqlerrm like '%say something%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform remark_session(v_shut, repeat('x', 501));
    assert false, 'a remark over 500 should have been refused';
  exception when others then
    assert sqlerrm like '%at most 500%', 'wrong error: ' || sqlerrm;
  end;

  -- ── Words with no figure: SKIP, then SEND ───────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  begin
    perform remark_session(v_shut, 'never played');
    assert false, 'a player with no score should not leave a remark';
  exception when others then
    assert sqlerrm like '%no score%', 'wrong error: ' || sqlerrm;
  end;
  perform submit_session_score(v_shut, 300, 2, 'hard', now());
  perform remark_session(v_shut, 'loved the colours');
  assert (select rating from session_ratings where session_id = v_shut and user_id = v_b) is null,
    'a words-only row should have no figure';

  -- A row may not say nothing at all.
  begin
    update session_ratings set remark = null where session_id = v_shut and user_id = v_b;
    assert false, 'a row with neither a figure nor words should have been refused';
  exception when check_violation then null;
  end;

  -- ── The lab's reads ─────────────────────────────────────────────────────────
  update profiles set role = 'admin' where id = v_b;
  assert (select ratings from challenge_ratings() where mode_id = 'challenge/remarked') = 1,
    'a words-only row should not count as a rating';
  assert (select average from challenge_ratings() where mode_id = 'challenge/remarked') = 5.0,
    'a words-only row should not move the average';
  assert (select count(*) from challenge_remarks('challenge/remarked')) = 2,
    'both remarks should be listed';
  assert exists (select 1 from challenge_remarks('challenge/remarked')
                  where remark = 'loved the colours' and rating is null),
    'a words-only remark should be listed with no figure';
  -- Never who said what: the read has no column naming the player.
  assert not exists (
    select 1 from information_schema.routines r
      join information_schema.parameters p on p.specific_name = r.specific_name
     where r.routine_name = 'challenge_remarks' and p.parameter_mode = 'OUT'
       and p.parameter_name in ('nickname', 'user_id')),
    'challenge_remarks must not hand out who wrote a remark';
  -- Every kind of whitespace is blank, not only spaces.
  begin
    perform remark_session(v_shut, E'\n\t\n');
    assert false, 'a remark of newlines and tabs should have been refused';
  exception when others then
    assert sqlerrm like '%say something%', 'wrong error: ' || sqlerrm;
  end;

  -- The log: every opened session, the player count and the winner by the measure.
  insert into challenge_sessions (mode_id, opens_at, closes_at, measure)
  values ('challenge/remarked', now() - interval '3 days', now() - interval '2 days', 'time')
  returning id into v_race;
  insert into session_scores (session_id, user_id, best_score, hits, time_ms, difficulty, updated_at)
  values (v_race, v_a, 9000, 9, 52000, 'hard', now() - interval '2 days 2 hours'),
         (v_race, v_b, 1200, 9, 41000, 'hard', now() - interval '2 days 1 hour');
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/remarked', now() - interval '6 days', now() - interval '5 days')
  returning id into v_empty;
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/remarked', now() + interval '1 day', now() + interval '2 days');

  assert (select count(*) from challenge_session_log('challenge/remarked')) = 3,
    'the log should hold every closed session, and no live or queued one';
  assert (select time_ms from challenge_session_log('challenge/remarked') where id = v_race) = 41000,
    'a race''s winner is the fastest time, not the highest score';
  assert (select players from challenge_session_log('challenge/remarked') where id = v_race) = 2,
    'the log should count the players';
  assert (select players from challenge_session_log('challenge/remarked') where id = v_empty) = 0
     and (select best_score from challenge_session_log('challenge/remarked') where id = v_empty) is null,
    'a session nobody played has no winner';
  assert (select id from challenge_session_log('challenge/remarked') limit 1) = v_shut,
    'the log should be newest first';

  update profiles set role = null where id = v_b;
  begin
    perform challenge_remarks('challenge/remarked');
    assert false, 'a non-admin should not read the remarks';
  exception when others then
    assert sqlerrm not like '%should not read%', 'wrong error: ' || sqlerrm;
  end;

  raise notice 'session_ratings.sql: remarks OK';
  delete from challenge_sessions where mode_id = 'challenge/remarked';
  perform set_config('request.jwt.claims', null, true);
  -- Leave the fixture as it was found: these files share one database.
  update profiles set nickname = null where nickname in ('REMARKER', 'QUIET');
end;
$$;

-- `set role`, not `set local role` — see session_scores.sql.
set role anon;
do $$
begin
  begin
    perform rate_session(gen_random_uuid(), 5);
    assert false, 'anon should not be able to rate';
  exception when insufficient_privilege then null;
  end;

  begin
    perform count(*) from session_ratings;
    assert false, 'anon should not be able to read ratings';
  exception when insufficient_privilege then null;
  end;

  begin
    perform challenge_ratings();
    assert false, 'anon should not be able to read the per-challenge figures';
  exception when insufficient_privilege then null;
  end;

  begin
    perform remark_session(gen_random_uuid(), 'hello');
    assert false, 'anon should not be able to leave a remark';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
