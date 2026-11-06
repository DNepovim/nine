-- Assertions over challenge_states: a pending challenge cannot be planned, players cannot
-- read it, and making one pending takes its planned sessions out of the queue.
--
-- Run with `pnpm db:test`, which resets the local database first.

do $$
declare
  v_admin uuid;
  v_other uuid;
  v_a     uuid;
  v_b     uuid;
  v_c     uuid;
  v_pair  uuid[];
  v_cut   int;
  v_slot  timestamptz;
  v_pair2 uuid[];
begin
  select id into v_admin from profiles order by id limit 1;
  select id into v_other from profiles order by id offset 1 limit 1;
  update profiles set role = 'admin' where id = v_admin;
  update profiles set role = null where id = v_other;
  -- From none: a local stack with the dev fixtures has sessions that would be "the last
  -- challenge" below.
  delete from challenge_sessions where opens_at > now() or opens_at <= now();
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── No row means live ───────────────────────────────────────────────────────
  assert not challenge_is_pending('challenge/state-a'), 'a challenge with no row is live';

  -- ── A pair is booked at once, and a pair needs two ──────────────────────────
  begin
    perform plan_challenge_pair('challenge/state-a', 'score', 'challenge/state-a', 'score');
    assert false, 'the same challenge twice should be refused';
  exception when others then
    assert sqlerrm like '%two different%', 'wrong error: ' || sqlerrm;
  end;
  v_pair := plan_challenge_pair('challenge/state-a', 'score', 'challenge/state-b', 'score');
  v_a := v_pair[1];
  v_b := v_pair[2];
  assert (select count(*) from challenge_sessions where opens_at > now()) = 2,
    'a pair should book two sessions';
  assert (select opens_at from challenge_sessions where id = v_a)
       < (select opens_at from challenge_sessions where id = v_b),
    'the pair should book in order';
  -- ── A pair moves as one: the second pair steps ahead of the first ───────────
  v_pair2 := plan_challenge_pair('challenge/state-c', 'score', 'challenge/state-d', 'score');
  perform move_challenge_pair(v_pair2[1], -1);
  assert (select mode_id from challenge_sessions where opens_at > now()
           order by opens_at, created_at limit 1) = 'challenge/state-c',
    'the moved pair should now open first';
  assert (select count(*) from challenge_sessions c1 join challenge_sessions c2
            on c1.mode_id = 'challenge/state-c' and c2.mode_id = 'challenge/state-d'
           where abs(extract(epoch from (c2.opens_at - c1.opens_at))) = 172800) = 1,
    'a pair should stay on neighbouring slots';
  begin
    perform move_challenge_pair(v_b, 1);
    assert false, 'the second of a pair should not start a move';
  exception when others then
    assert sqlerrm like '%does not start a pair%' or sqlerrm like '%no longer%',
      'wrong error: ' || sqlerrm;
  end;
  delete from challenge_sessions where mode_id in ('challenge/state-c', 'challenge/state-d');

  v_c := plan_challenge_session('challenge/state-a');

  -- ── Pending removes exactly the planned sessions ────────────────────────────
  select opens_at into v_slot from challenge_sessions where id = v_a;
  v_cut := set_challenge_state('challenge/state-a', 'pending');
  assert v_cut = 2, 'both planned sessions of the challenge should go, not ' || v_cut;
  assert (select count(*) from challenge_sessions where mode_id = 'challenge/state-a') = 0;
  assert (select count(*) from challenge_sessions where id = v_b) = 1,
    'another challenge stays queued';
  assert challenge_is_pending('challenge/state-a');
  assert (select opens_at from challenge_sessions where id = v_b) = v_slot,
    'what was behind the removed sessions should move up into the freed first slot';

  -- ── A pending challenge cannot be planned, paired or re-pointed to ──────────
  begin
    perform plan_challenge_session('challenge/state-a');
    assert false, 'planning a pending challenge should be refused';
  exception when others then
    assert sqlerrm like '%pending%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform plan_challenge_pair('challenge/state-a', 'score', 'challenge/state-c', 'score');
    assert false, 'pairing a pending challenge should be refused';
  exception when others then
    assert sqlerrm like '%pending%', 'wrong error: ' || sqlerrm;
  end;
  assert (select count(*) from challenge_sessions where mode_id = 'challenge/state-c') = 0,
    'a refused pair should leave nothing booked';
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
  -- It is hidden from players, so nobody could have played it: the vote's eligibility must
  -- look past it to the latest session players can see.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/state-b', now() - interval '3 hours', now() - interval '2 hours')
  returning id into v_c;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_c, v_admin, 10, 1, 'easy', now() - interval '2 hours');
  perform plan_challenge_session('challenge/state-c');
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
