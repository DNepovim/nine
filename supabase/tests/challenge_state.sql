-- Assertions over challenge_states: a pending challenge cannot be planned, players cannot
-- read it, and making one pending takes it out of the queue. The candidate side of that —
-- trimming a session that has another candidate — is in `session_candidates.sql`.
--
-- Run with `pnpm db:test`, which resets the local database first.

do $$
declare
  v_admin uuid;
  v_other uuid;
  v_a     uuid;
  v_b     uuid;
  v_cut   int;
  v_slot  timestamptz;
begin
  select id into v_admin from profiles order by id limit 1;
  select id into v_other from profiles order by id offset 1 limit 1;
  update profiles set role = 'admin' where id = v_admin;
  update profiles set role = null where id = v_other;
  -- From none: a local stack with the dev fixtures has sessions that would be in the way.
  delete from challenge_sessions;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── No row means live ───────────────────────────────────────────────────────
  assert not challenge_is_pending('challenge/state-a'), 'a challenge with no row is live';

  -- ── Pending removes a session that was only that challenge, and closes the gap ─
  v_a := plan_challenge_session('challenge/state-a');
  v_b := plan_challenge_session('challenge/state-b');
  select opens_at into v_slot from challenge_sessions where id = v_a;
  v_cut := set_challenge_state('challenge/state-a', 'pending');
  assert v_cut = 1, 'the one session of the challenge should go, not ' || v_cut;
  assert (select count(*) from challenge_sessions where mode_id = 'challenge/state-a') = 0;
  assert (select opens_at from challenge_sessions where id = v_b) = v_slot,
    'what was behind the removed session should move up into the freed first slot';
  assert challenge_is_pending('challenge/state-a');

  -- ── A pending challenge cannot be planned or pointed at ─────────────────────
  begin
    perform plan_challenge_session('challenge/state-a');
    assert false, 'planning a pending challenge should be refused';
  exception when others then
    assert sqlerrm like '%pending%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform plan_challenge_session('challenge/state-b', 'score', 'challenge/state-a', 'score');
    assert false, 'a pending second candidate should be refused';
  exception when others then
    assert sqlerrm like '%pending%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform edit_challenge_session(v_b, 'challenge/state-a');
    assert false, 'pointing a booking at a pending challenge should be refused';
  exception when others then
    assert sqlerrm like '%pending%', 'wrong error: ' || sqlerrm;
  end;

  -- ── Players do not read a pending challenge's sessions ──────────────────────
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/state-a', now() - interval '1 hour', now() + interval '1 hour');
  assert (select count(*) from open_sessions_with_leaders() where mode_id = 'challenge/state-a') = 0,
    'the start screen should not list a pending challenge, running or not';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  assert (select count(*) from challenge_sessions where mode_id = 'challenge/state-a') = 0,
    'a player should not read a pending challenge''s session';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  assert (select count(*) from challenge_sessions where mode_id = 'challenge/state-a') = 1,
    'an admin should still read it';
  reset role;

  -- ── A pending challenge's running session is not "the last challenge" ───────
  -- Hidden from players, so nobody could have played it: the vote's eligibility must look
  -- past it to the latest session players can see.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/state-b', now() - interval '3 hours', now() - interval '2 hours')
  returning id into v_a;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_a, v_admin, 10, 1, 'easy', now() - interval '2 hours');
  perform edit_challenge_session(v_b, 'challenge/state-b', 'score', 'challenge/state-c', 'score');
  assert (select can_vote from next_vote_options() limit 1),
    'a pending challenge''s running session should not decide who may vote';

  -- ── Live again restores nothing ─────────────────────────────────────────────
  assert set_challenge_state('challenge/state-a', 'live') = 0;
  assert not challenge_is_pending('challenge/state-a');
  assert (select count(*) from open_sessions_with_leaders() where mode_id = 'challenge/state-a') = 1,
    'a live challenge is listed again';

  -- ── Only an admin sets a state ──────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  begin
    perform set_challenge_state('challenge/state-a', 'pending');
    assert false, 'a non-admin should not set a state';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;
end;
$$;
