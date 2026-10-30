-- Assertions over record_session_run: the receipt a challenge run leaves, what it must
-- not touch, and that the analytics count it.
--
-- Run with `pnpm db:test`, which resets the local database first.
--
-- What matters most here is the second block. A challenge run reaching `player_totals`
-- would credit the fortune with a run the session already pays for, and nothing on any
-- screen would show it had happened.

do $$
declare
  v_a       uuid;
  v_admin   uuid;
  v_open    uuid;
  v_other   uuid;
  v_shut    uuid;
  v_run     uuid := gen_random_uuid();
  v_zero    uuid := gen_random_uuid();
  v_late    uuid := gen_random_uuid();
  v_admins  uuid := gen_random_uuid();
  v_open_run uuid := gen_random_uuid();
  v_live_a  uuid := gen_random_uuid();
  v_live_ad uuid := gen_random_uuid();
  v_totals  bigint;
  v_scores  bigint;
  v_stats   jsonb;
  v_today   date := (now() at time zone 'Europe/Prague')::date;
begin
  select id into v_a     from profiles order by id limit 1;
  select id into v_admin from profiles order by id offset 1 limit 1;
  update profiles set nickname = 'TESTER_A' where id = v_a;
  update profiles set role = 'admin' where id = v_admin;

  -- `record_session_run` asks whether the caller's device still holds the profile, which
  -- is a row in `auth.sessions` named by the token.
  insert into auth.sessions (id, user_id) values (v_live_a, v_a), (v_live_ad, v_admin);

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/receipts', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_open;
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/elsewhere', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_other;
  -- Shut an hour ago: well past the standings' ten-minute grace.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/shut', now() - interval '3 hours', now() - interval '1 hour')
  returning id into v_shut;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'session_id', v_live_a)::text, true);

  select count(*) into v_totals from player_totals;
  select count(*) into v_scores from session_scores;

  -- ── The receipt ─────────────────────────────────────────────────────────────
  -- Posted early, then again at game over with more: one row, the larger figures.
  perform record_session_run(v_run, v_open, 'hard', 300, 4, 20000, false);
  perform record_session_run(v_run, v_open, 'hard', 900, 11, 61000, true);
  assert (select count(*) from run_receipts where run_id = v_run) = 1,
    'a run posted twice should leave one receipt';
  assert (select mode from run_receipts where run_id = v_run) = 'challenge/receipts',
    'the receipt should carry the session''s mode';
  assert (select session_id from run_receipts where run_id = v_run) = v_open,
    'the receipt should carry its session';
  assert (select (score, hits, elapsed_ms, settled, difficulty) from run_receipts where run_id = v_run)
         = (900::bigint, 11, 61000::bigint, true, 'hard'::text),
    'the receipt should hold the final post''s figures, settled';

  -- A run that scored nothing is still a run.
  perform record_session_run(v_zero, v_open, 'hard', 0, 0, 4000, true);
  assert exists (select 1 from run_receipts where run_id = v_zero and settled),
    'a run that scored nought should still leave a receipt';

  -- No window: the standings shut ten minutes after the close, the counts do not.
  perform record_session_run(v_late, v_shut, 'easy', 50, 2, 9000, true);
  assert exists (select 1 from run_receipts where run_id = v_late),
    'a run on a closed session should still be counted';

  -- ── What it must not touch ──────────────────────────────────────────────────
  assert (select count(*) from player_totals) = v_totals,
    'a session run must not reach player_totals';
  assert (select count(*) from session_scores) = v_scores,
    'a session run must not write the standings';

  -- ── Settled, foreign and confused ───────────────────────────────────────────
  perform record_session_run(v_run, v_open, 'hard', 5000, 40, 90000, true);
  assert (select score from run_receipts where run_id = v_run) = 900,
    'a settled receipt should take nothing more';

  begin
    perform record_session_run(v_zero, v_other, 'hard', 10, 1, 1000, true);
    -- Settled already, so this is a no-op rather than a refusal. Asserted to keep the
    -- order of the guards honest: settled is checked before the session.
  exception when others then
    assert false, 'a post to a settled receipt should be a quiet no-op: ' || sqlerrm;
  end;

  perform record_session_run(v_open_run, v_open, 'hard', 10, 1, 1000, false);
  begin
    perform record_session_run(v_open_run, v_other, 'hard', 20, 2, 2000, true);
    assert false, 'the same run under another session should have been refused';
  exception when others then
    assert sqlerrm like '%session changed mid-run%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform record_session_run(v_open_run, v_open, 'extreme', 20, 2, 2000, true);
    assert false, 'the same run at another difficulty should have been refused';
  exception when others then
    assert sqlerrm like '%difficulty changed mid-run%', 'wrong error: ' || sqlerrm;
  end;
  perform record_session_run(v_open_run, v_open, 'hard', 20, 2, 2000, true);

  -- ── Refusals ────────────────────────────────────────────────────────────────
  begin
    perform record_session_run(gen_random_uuid(), gen_random_uuid(), 'hard', 1, 1, 1, true);
    assert false, 'an unknown session should have been refused';
  exception when others then
    assert sqlerrm like '%no such session%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform record_session_run(gen_random_uuid(), v_open, 'medium', 1, 1, 1, true);
    assert false, 'an unknown difficulty should have been refused';
  exception when others then
    assert sqlerrm like '%unknown difficulty%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform record_session_run(gen_random_uuid(), v_open, 'hard', -1, 1, 1, true);
    assert false, 'a negative score should have been refused';
  exception when others then
    assert sqlerrm like '%negative%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform record_session_run(gen_random_uuid(), v_open, 'hard', 1, 1, 86400001, true);
    assert false, 'a day-long run should have been refused';
  exception when others then
    assert sqlerrm like '%elapsed out of range%', 'wrong error: ' || sqlerrm;
  end;

  -- ── Another player's run ────────────────────────────────────────────────────
  -- The admin posting under A's run id changes nothing, and the admin's own run is one
  -- the analytics leave out.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'session_id', v_live_ad)::text, true);
  perform record_session_run(v_open_run, v_open, 'hard', 99999, 99, 99999, true);
  assert (select user_id from run_receipts where run_id = v_open_run) = v_a,
    'another player''s receipt should be left alone';
  assert (select score from run_receipts where run_id = v_open_run) = 20,
    'another player''s receipt should keep its figures';
  perform record_session_run(v_admins, v_open, 'hard', 700, 7, 30000, true);

  -- ── The analytics count it ──────────────────────────────────────────────────
  v_stats := admin_stats(v_today, v_today);
  assert (v_stats -> 'runs' ->> 'runs')::int >= 4,
    'RUNS should count the player''s challenge runs: ' || (v_stats -> 'runs')::text;
  assert exists (
    select 1 from jsonb_array_elements(v_stats -> 'boards') b
    where b ->> 'mode' = 'challenge/receipts' and (b ->> 'runs')::int = 3
  ), 'the breakdown should hold the challenge, without the admin''s run: '
     || (v_stats -> 'boards')::text;
  assert (
    select (s ->> 'runs')::int from jsonb_array_elements(v_stats -> 'series') s
    where s ->> 'day' = v_today::text
  ) >= 4, 'today''s bar should count the challenge runs';
  assert exists (
    select 1 from jsonb_array_elements(admin_stats_people(v_today, v_today)) p
    where (p ->> 'user_id')::uuid = v_a and (p ->> 'runs')::int = 4
          and (p ->> 'hits')::int = 11 + 0 + 2 + 2
          and (p ->> 'elapsed_ms')::bigint = 61000 + 4000 + 9000 + 2000
  ), 'the player should be listed with their challenge runs';
  assert not exists (
    select 1 from jsonb_array_elements(admin_stats_people(v_today, v_today)) p
    where (p ->> 'user_id')::uuid = v_admin and (p ->> 'runs')::int > 0
  ), 'an admin''s challenge run should be counted nowhere';

  -- The files after this one read the seed's roles as shipped.
  update profiles set role = null where id = v_admin;

  raise notice 'session_run_receipts.sql: the receipt, its limits and the analytics OK';
end;
$$;
