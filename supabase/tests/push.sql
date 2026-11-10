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
