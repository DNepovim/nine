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
end;
$$;
reset role;
