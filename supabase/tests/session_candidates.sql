-- Assertions over a session's two candidates: booking, the vote that leads the session,
-- editing a candidate, the pending trim and the admin reads.
--
-- Run with `pnpm db:test`, which resets the local database first. The queue merge is a
-- one-time migration step and is checked by hand against the queue it runs on.

do $$
declare
  v_admin uuid;
  v_other uuid;
  v_plain uuid;
  v_past  uuid;
  v_s     uuid;
  v_t     uuid;
  v_n     int;
begin
  select id into v_admin from profiles order by id limit 1;
  select id into v_other from profiles order by id offset 1 limit 1;
  select id into v_plain from profiles order by id offset 2 limit 1;
  update profiles set role = 'admin' where id = v_admin;
  update profiles set role = null where id in (v_other, v_plain);
  delete from challenge_sessions;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- The last challenge: v_admin and v_other played it, v_plain did not.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/c-past', now() - interval '2 days', now() - interval '1 day')
  returning id into v_past;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_past, v_admin, 10, 1, 'easy', now() - interval '2 days'),
         (v_past, v_other, 10, 1, 'easy', now() - interval '2 days');

  -- ── One session, two candidates, one date ───────────────────────────────────
  v_s := plan_challenge_session('challenge/c-a', 'score', 'challenge/c-b', 'hits');
  assert (select count(*) from challenge_sessions where opens_at > now()) = 1,
    'two candidates are one session';
  assert (select alt_mode_id from challenge_sessions where id = v_s) = 'challenge/c-b';
  assert (select alt_measure from challenge_sessions where id = v_s) = 'hits';
  begin
    perform plan_challenge_session('challenge/c-x', 'score', 'challenge/c-y', null);
    assert false, 'a second candidate without a measure should be refused';
  exception when others then
    assert sqlerrm like '%needs a measure%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform plan_challenge_session('challenge/c-a', 'score', 'challenge/c-a', 'score');
    assert false, 'the same candidate twice should be refused';
  exception when others then
    assert sqlerrm like '%different%', 'wrong error: ' || sqlerrm;
  end;
  v_t := plan_challenge_session('challenge/c-d', 'score', 'challenge/c-e', 'score');
  assert (select alt_mode_id from challenge_sessions where id = v_t) = 'challenge/c-e';
  assert (select opens_at from challenge_sessions where id = v_s)
       < (select opens_at from challenge_sessions where id = v_t), 'booked in order';
  -- A single is still a session.
  perform plan_challenge_session('challenge/c-f');
  assert (select count(*) from challenge_sessions where alt_mode_id is null and opens_at > now()) = 1;

  -- ── Voting is on the first planned session with two candidates ──────────────
  assert (select count(*) from next_vote_options()) = 2, 'two candidates are offered';
  assert (select array_agg(mode_id order by mode_id) from next_vote_options())
       = array['challenge/c-a', 'challenge/c-b'];

  -- ── A vote leads the session, with its measure ──────────────────────────────
  perform vote_next(v_s, 'challenge/c-b');
  assert (select mode_id from challenge_sessions where id = v_s) = 'challenge/c-b',
    'the candidate with more votes should lead';
  assert (select measure from challenge_sessions where id = v_s) = 'hits',
    'the measure should follow the leader';
  assert (select alt_mode_id from challenge_sessions where id = v_s) = 'challenge/c-a';

  -- A tie goes to the candidate booked first, whichever has been ahead.
  perform set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  perform vote_next(v_s, 'challenge/c-a');
  assert (select mode_id from challenge_sessions where id = v_s) = 'challenge/c-a',
    'a tie should go to the candidate booked first';
  assert (select measure from challenge_sessions where id = v_s) = 'score';

  -- A second vote moves the first.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  perform vote_next(v_s, 'challenge/c-a');
  assert (select count(*) from next_votes where session_id = v_s) = 2, 'one vote per player';
  assert (select mode_id from challenge_sessions where id = v_s) = 'challenge/c-a',
    'moving a vote should lead the other way';
  assert (select measure from challenge_sessions where id = v_s) = 'score';

  -- A player of the last challenge only.
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain)::text, true);
  begin
    perform vote_next(v_s, 'challenge/c-a');
    assert false, 'a non-player should not vote';
  exception when others then
    assert sqlerrm like '%only players%', 'wrong error: ' || sqlerrm;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  -- While a session is running nothing is voted on: the ballot is empty and a vote refused.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/c-running', now() - interval '1 hour', now() + interval '23 hours');
  assert (select count(*) from next_vote_options()) = 0, 'no vote while a session runs';
  begin
    perform vote_next(v_s, 'challenge/c-a');
    assert false, 'a vote during a running session should be refused';
  exception when others then
    assert sqlerrm like '%not up for a vote%', 'wrong error: ' || sqlerrm;
  end;
  delete from challenge_sessions where mode_id = 'challenge/c-running';
  assert (select count(*) from next_vote_options()) = 2, 'the vote is back once it closes';

  -- The two tiles keep their order whoever leads.
  assert array(select mode_id from next_vote_options())
       = array['challenge/c-a', 'challenge/c-b'], 'candidates are offered in a fixed order';
  -- Not a candidate, and not the next session.
  begin
    perform vote_next(v_s, 'challenge/c-z');
    assert false, 'a stranger should not take a vote';
  exception when others then
    assert sqlerrm like '%not up for a vote%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform vote_next(v_t, 'challenge/c-d');
    assert false, 'a later session is not being voted on';
  exception when others then
    assert sqlerrm like '%not up for a vote%', 'wrong error: ' || sqlerrm;
  end;

  -- ── Editing a candidate drops only its votes ────────────────────────────────
  -- Votes now: admin -> c-a, other -> c-a? the other voted c-a and admin moved to c-a.
  perform set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  perform vote_next(v_s, 'challenge/c-b');
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  assert (select count(*) from next_votes where session_id = v_s and mode_id = 'challenge/c-b') = 1;
  perform edit_challenge_session(v_s, 'challenge/c-a', 'score', 'challenge/c-c', 'score');
  assert (select count(*) from next_votes where session_id = v_s and mode_id = 'challenge/c-b') = 0,
    'the replaced candidate''s votes should go';
  assert (select count(*) from next_votes where session_id = v_s and mode_id = 'challenge/c-a') = 1,
    'the other candidate keeps its vote';
  assert (select alt_mode_id from challenge_sessions where id = v_s) = 'challenge/c-c';
  assert (select mode_id from challenge_sessions where id = v_s) = 'challenge/c-a';
  assert (select count(*) from session_voters(v_s)) = 1, 'an admin reads who voted';

  -- ── Pending trims a candidate, or removes a session that was only it ────────
  v_n := set_challenge_state('challenge/c-e', 'pending');
  assert v_n = 1, 'one session lost a candidate, not ' || v_n;
  assert (select alt_mode_id from challenge_sessions where id = v_t) is null
     and (select mode_id from challenge_sessions where id = v_t) = 'challenge/c-d',
    'the session keeps its date and the other candidate';
  assert (select opens_at from challenge_sessions where id = v_t) is not null;
  v_n := set_challenge_state('challenge/c-f', 'pending');
  assert v_n = 1 and (select count(*) from challenge_sessions where mode_id = 'challenge/c-f') = 0,
    'a session that was only the held-back challenge is removed';
  v_n := set_challenge_state('challenge/c-a', 'pending');
  assert (select mode_id from challenge_sessions where id = v_s) = 'challenge/c-c',
    'the leader going pending hands the session to the other candidate';
  begin
    perform plan_challenge_session('challenge/c-a', 'score', 'challenge/c-b', 'score');
    assert false, 'a pending candidate should be refused';
  exception when others then
    assert sqlerrm like '%pending%', 'wrong error: ' || sqlerrm;
  end;

  -- ── An opened session cannot be edited or voted on ──────────────────────────
  insert into challenge_sessions
    (mode_id, measure, alt_mode_id, alt_measure, first_mode_id, opens_at, closes_at)
  values ('challenge/c-g', 'score', 'challenge/c-h', 'score', 'challenge/c-g',
          now() - interval '1 hour', now() + interval '23 hours');
  begin
    perform edit_challenge_session(
      (select id from challenge_sessions where mode_id = 'challenge/c-g'),
      'challenge/c-g', 'score', 'challenge/c-i', 'score');
    assert false, 'an opened session should not change candidates';
  exception when others then
    assert sqlerrm like '%has opened%', 'wrong error: ' || sqlerrm;
  end;

  -- ── The admin reads ─────────────────────────────────────────────────────────
  perform session_run_counts(v_s);
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain)::text, true);
  begin
    perform session_voters(v_s);
    assert false, 'a non-admin should not read voters';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform session_run_counts(v_s);
    assert false, 'a non-admin should not read run counts';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;
end;
$$;
