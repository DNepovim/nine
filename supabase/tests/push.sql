-- Assertions over push: who may save a subscription, what a takeover owes, and that a board
-- changing hands twice in a day owes once.
--
-- Run with `pnpm db:test`, which resets the local database first.

do $$
declare
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_n int;
begin
  select id into v_a from profiles where nickname is not null order by id limit 1;
  select id into v_b from profiles where nickname is not null order by id offset 1 limit 1;
  select id into v_c from profiles where nickname is not null order by id offset 2 limit 1;

  -- A board of our own to fight over, so the seeded reigns are never in the way.
  delete from board_reigns where mode = 'speed' and difficulty = 'extreme';

  -- ── The feature ─────────────────────────────────────────────────────────────
  assert (select visibility from features where key = 'push') = 'hidden',
    'push should be hidden';
  assert (select count(*) from role_features where feature_key = 'push') = 3,
    'push should be in every working stack';

  -- ── Saving a subscription ───────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform save_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/a', 'k', 'a', 'cs');
  assert (select user_id from push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a') = v_a,
    'the subscription should belong to its saver';

  -- Only a push service's address, and with its keys.
  begin
    perform save_push_subscription('web', 'http://fcm.googleapis.com/x', 'k', 'a', 'en');
    assert false, 'a plain http endpoint should be refused';
  exception when others then
    assert sqlerrm like '%not a push service%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform save_push_subscription('web', 'https://internal.example/x', 'k', 'a', 'en');
    assert false, 'a foreign host should be refused';
  exception when others then
    assert sqlerrm like '%not a push service%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform save_push_subscription('web', 'https://fcm.googleapis.com.evil.example/x', 'k', 'a', 'en');
    assert false, 'a lookalike host should be refused';
  exception when others then
    assert sqlerrm like '%not a push service%', 'wrong error: ' || sqlerrm;
  end;
  begin
    perform save_push_subscription('web', 'https://fcm.googleapis.com/x', null, 'a', 'en');
    assert false, 'a web subscription without keys should be refused';
  exception when others then
    assert sqlerrm like '%keys%', 'wrong error: ' || sqlerrm;
  end;

  -- Re-saving the same device from another profile moves it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform save_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/a', 'k', 'a', 'en');
  assert (select user_id from push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a') = v_b,
    'a re-saved endpoint should move to the new profile';
  assert (select count(*) from push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a') = 1,
    'one device, one row';

  -- Dropping somebody else's is a no-op.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform drop_push_subscription('https://fcm.googleapis.com/fcm/send/a');
  assert exists (select 1 from push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a'),
    'a profile should not drop another profile''s subscription';

  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform drop_push_subscription('https://fcm.googleapis.com/fcm/send/a');
  assert not exists (select 1 from push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a'),
    'a profile should drop its own subscription';

  -- ── No door for a client ────────────────────────────────────────────────────
  set local role authenticated;
  begin
    perform 1 from push_subscriptions;
    assert false, 'authenticated should not read subscriptions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from push_outbox;
    assert false, 'authenticated should not read the outbox';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- The function prunes dead endpoints as service_role, so it must be able to.
  assert has_table_privilege('service_role', 'push_subscriptions', 'DELETE'),
    'service_role should be able to delete a dead subscription';

  -- ── A takeover owes the displaced holder ────────────────────────────────────
  -- A holds the board and has a device; B takes it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform save_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/dev-a', 'k', 'a', 'en');

  -- With the feature hidden nothing is owed, however many people are subscribed.
  insert into board_reigns (user_id, mode, difficulty, score, took_at)
  values (v_a, 'speed', 'extreme', 50, now() - interval '4 days');
  update board_reigns set lost_at = now() - interval '3 days'
   where user_id = v_a and mode = 'speed' and difficulty = 'extreme' and lost_at is null;
  insert into board_reigns (user_id, mode, difficulty, score, took_at)
  values (v_c, 'speed', 'extreme', 60, now() - interval '3 days');
  assert not exists (select 1 from push_outbox), 'a hidden feature should owe nothing';
  delete from board_reigns where mode = 'speed' and difficulty = 'extreme';
  update features set visibility = 'public' where key = 'push';

  insert into board_reigns (user_id, mode, difficulty, score, took_at)
  values (v_a, 'speed', 'extreme', 100, now() - interval '2 days');
  update board_reigns set lost_at = now() - interval '1 hour'
   where user_id = v_a and mode = 'speed' and difficulty = 'extreme' and lost_at is null;
  insert into board_reigns (user_id, mode, difficulty, score, took_at)
  values (v_b, 'speed', 'extreme', 200, now() - interval '1 hour');

  select count(*) into v_n from push_outbox where user_id = v_a;
  assert v_n = 1, 'the displaced holder should be owed one push, got ' || v_n;
  assert (select by_nickname from push_outbox where user_id = v_a)
       = (select nickname from profiles where id = v_b),
    'the push should name the taker';
  assert not exists (select 1 from push_outbox where user_id = v_b),
    'the taker is owed nothing';

  -- Back and forth the same day: A retakes, B retakes, B is owed nothing (no device) and
  -- A is not owed twice.
  update board_reigns set lost_at = now() - interval '30 minutes'
   where user_id = v_b and mode = 'speed' and difficulty = 'extreme' and lost_at is null;
  insert into board_reigns (user_id, mode, difficulty, score, took_at)
  values (v_a, 'speed', 'extreme', 300, now() - interval '30 minutes');
  update board_reigns set lost_at = now() - interval '10 minutes'
   where user_id = v_a and mode = 'speed' and difficulty = 'extreme' and lost_at is null;
  insert into board_reigns (user_id, mode, difficulty, score, took_at)
  values (v_c, 'speed', 'extreme', 400, now() - interval '10 minutes');
  select count(*) into v_n from push_outbox where user_id = v_a;
  assert v_n = 1, 'a second takeover the same day should add nothing, got ' || v_n;

  -- A player with no device is owed nothing.
  assert not exists (select 1 from push_outbox where user_id = v_b),
    'a holder without a subscription is not owed a push';

  -- ── Draining ────────────────────────────────────────────────────────────────
  select count(*) into v_n from drain_push_outbox(10);
  assert v_n = 1, 'one owed push to one device should claim one row, got ' || v_n;
  select count(*) into v_n from drain_push_outbox(10);
  assert v_n = 0, 'a claimed push should not be claimed twice';

  -- Tidy: the suite resets before it runs, but other files read these tables after.
  delete from push_outbox;
  delete from push_subscriptions;
  delete from board_reigns where mode = 'speed' and difficulty = 'extreme';
  update features set visibility = 'hidden' where key = 'push';
end
$$;

-- ─── Every board, and a session's lead ───────────────────────────────────────
-- A takeover in any of the three periods owes one push, for the widest of them; a live
-- session board owes one when its lead is passed.

do $$
declare
  v_a     uuid;
  v_b     uuid;
  v_c     uuid;
  v_today date := (now() at time zone 'Europe/Prague')::date;
  -- Monday's week is only its own day, so there is no "earlier this week" to have led from.
  v_midweek boolean := extract(isodow from (now() at time zone 'Europe/Prague')) > 1;
  v_s     uuid;
  v_t     uuid;
  v_grace uuid;
  v_n     int;
begin
  select id into v_a from profiles where nickname is not null order by id limit 1;
  select id into v_b from profiles where nickname is not null order by id offset 1 limit 1;
  select id into v_c from profiles where nickname is not null order by id offset 2 limit 1;

  delete from push_outbox;
  delete from push_subscriptions;
  delete from daily_scores where mode = 'speed';
  delete from scores where mode = 'speed';
  delete from board_reigns where mode = 'speed';
  update features set visibility = 'public' where key = 'push';

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform save_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/every-a', 'k', 'a', 'en');

  -- ── Day ─────────────────────────────────────────────────────────────────────
  -- A leads all time from ten days back, and this week from earlier in it.
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_a, 'speed', 'hard', v_today - 10, 900, 9, now() - interval '10 days');
  if v_midweek then
    insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
    values (v_a, 'speed', 'hard', v_today - 1, 500, 9, now() - interval '1 day');
  end if;
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_a, 'speed', 'hard', v_today, 50, 9, now() - interval '2 hours');
  assert not exists (select 1 from push_outbox), 'holding a board owes nothing';

  -- B takes today and nothing wider.
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_b, 'speed', 'hard', v_today, 60, 9, now() - interval '1 hour');
  select count(*) into v_n from push_outbox where user_id = v_a;
  assert v_n = 1, 'one push for the day, got ' || v_n;
  assert (select period from push_outbox where user_id = v_a)
       = case when v_midweek then 'day' else 'week' end,
    'the narrowest takeover should be a day (a week on a Monday, where they are one board)';
  assert (select kind from push_outbox where user_id = v_a) = 'takeover', 'a takeover';

  -- ── Week ────────────────────────────────────────────────────────────────────
  -- B passes A's best day of the week: the week is lost, and the unsent day row is
  -- replaced rather than added to.
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_b, 'speed', 'hard', v_today, 600, 9, now() - interval '50 minutes')
  on conflict (user_id, mode, difficulty, day) do update set best_score = excluded.best_score,
    updated_at = excluded.updated_at;
  select count(*) into v_n from push_outbox where user_id = v_a;
  assert v_n = 1, 'a wider takeover replaces the unsent narrower, got ' || v_n;
  assert (select period from push_outbox where user_id = v_a) = 'week',
    'the week is the widest taken so far';

  -- ── Ever ────────────────────────────────────────────────────────────────────
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_b, 'speed', 'hard', v_today, 1000, 9, now() - interval '40 minutes')
  on conflict (user_id, mode, difficulty, day) do update set best_score = excluded.best_score,
    updated_at = excluded.updated_at;
  select count(*) into v_n from push_outbox where user_id = v_a;
  assert v_n = 1, 'one push however many boards one score takes, got ' || v_n;
  assert (select period from push_outbox where user_id = v_a) = 'ever',
    'the all-time board is the widest';
  assert not exists (select 1 from push_outbox where user_id = v_b), 'the taker is owed nothing';

  -- Once it has gone out, a narrower loss the same day is not worth another push.
  perform drain_push_outbox(10);
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_a, 'speed', 'hard', v_today, 2000, 9, now() - interval '30 minutes')
  on conflict (user_id, mode, difficulty, day) do update set best_score = excluded.best_score,
    updated_at = excluded.updated_at;
  assert not exists (select 1 from push_outbox where user_id = v_b),
    'B has no device, so retaking owes nothing';

  -- ── What is not a takeover ──────────────────────────────────────────────────
  delete from push_outbox;
  -- A tie never takes: the earlier score keeps the board.
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_a, 'speed', 'extreme', v_today, 300, 9, now() - interval '3 hours');
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform save_push_subscription('web', 'https://fcm.googleapis.com/fcm/send/every-b', 'k', 'a', 'en');
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_b, 'speed', 'extreme', v_today, 300, 9, now() - interval '1 hour');
  assert not exists (select 1 from push_outbox), 'a tie should take nothing';

  -- A score for a day that has passed is history.
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_a, 'speed', 'easy', v_today - 3, 100, 9, now() - interval '3 days');
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_b, 'speed', 'easy', v_today - 3, 200, 9, now() - interval '3 days' + interval '1 minute');
  assert not exists (select 1 from push_outbox where mode = 'speed' and difficulty = 'easy'
                       and period in ('day', 'week')),
    'a late score for a past day owes no day or week push';

  -- Hiding the feature stops them.
  delete from push_outbox;
  update features set visibility = 'hidden' where key = 'push';
  insert into daily_scores (user_id, mode, difficulty, day, best_score, hits, updated_at)
  values (v_b, 'speed', 'extreme', v_today, 400, 9, now())
  on conflict (user_id, mode, difficulty, day) do update set best_score = excluded.best_score,
    updated_at = excluded.updated_at;
  assert not exists (select 1 from push_outbox), 'a hidden feature owes nothing';
  update features set visibility = 'public' where key = 'push';

  -- ── A session board ─────────────────────────────────────────────────────────
  delete from push_outbox;
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_s;
  insert into challenge_sessions (mode_id, measure, opens_at, closes_at)
  values ('challenge/no-slip', 'time', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_t;
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/grace', now() - interval '2 hours', now() - interval '2 minutes')
  returning id into v_grace;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_s, 100, 9, 'hard', now() - interval '30 minutes');
  assert not exists (select 1 from push_outbox), 'the first score on a board passes nobody';

  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_s, 200, 9, 'hard', now() - interval '20 minutes');
  select count(*) into v_n from push_outbox where user_id = v_a and kind = 'passed';
  assert v_n = 1, 'passing the leader owes them one push, got ' || v_n;
  assert (select mode from push_outbox where kind = 'passed') = 'challenge/four-keys'
     and (select session_id from push_outbox where kind = 'passed') = v_s
     and (select period from push_outbox where kind = 'passed') is null,
    'a passed row names the session and has no period';

  -- A leader extending the lead owes nothing; losing it to the same player again owes none.
  perform submit_session_score(v_s, 250, 9, 'hard', now() - interval '10 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_s, 300, 9, 'hard', now() - interval '9 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_s, 400, 9, 'hard', now() - interval '8 minutes');
  select count(*) into v_n from push_outbox where kind = 'passed' and user_id = v_a;
  assert v_n = 1, 'one passed push per player per session, got ' || v_n;
  -- B has a device by now, and A passing B in the middle was B's own once.
  select count(*) into v_n from push_outbox where kind = 'passed' and user_id = v_b;
  assert v_n = 1, 'the player who was passed back is owed one too, got ' || v_n;

  -- A race is ordered by time: more hits first, then the faster.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_t, 10, 5, 'hard', now() - interval '30 minutes', 9000);
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_t, 10, 5, 'hard', now() - interval '20 minutes', 8000);
  assert exists (select 1 from push_outbox where kind = 'passed' and session_id = v_t
                   and user_id = v_a),
    'the faster time passes the slower on a timed session';

  -- The grace after a close settles the standings; it does not lose anyone the lead.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform submit_session_score(v_grace, 100, 7, 'hard', now());
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform submit_session_score(v_grace, 200, 7, 'hard', now());
  assert not exists (select 1 from push_outbox where session_id = v_grace),
    'a score in the grace owes nothing';

  -- Drain carries the two new columns: A for each session, B for the first.
  select count(*) into v_n from drain_push_outbox(10) where kind = 'passed' and session_id is not null;
  assert v_n = 3, 'every passed row drains with its session, got ' || v_n;

  -- Tidy.
  delete from push_outbox;
  delete from push_subscriptions;
  delete from session_scores where session_id in (v_s, v_t, v_grace);
  delete from challenge_sessions where id in (v_s, v_t, v_grace);
  delete from daily_scores where mode = 'speed';
  delete from scores where mode = 'speed';
  delete from board_reigns where mode = 'speed';
  update features set visibility = 'hidden' where key = 'push';
end
$$;
