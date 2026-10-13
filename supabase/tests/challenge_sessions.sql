-- Assertions over challenge_sessions: the constraint, the clash check, the admin guard
-- and who may read.
--
-- Run with `pnpm db:test`, which resets the local database first. Plain `assert` rather
-- than pgTAP, matching features.sql — this repo carries no SQL test dependency and one
-- assertion that raises is all a failing test has to do.
--
-- The overlap rule is the reason this file exists. It is a check inside the write path
-- rather than an exclusion constraint, so nothing but these assertions holds it: a
-- future RPC that forgets to call `challenge_session_clashes` would pass every other
-- gate in the repo.

do $$
declare
  v_id uuid;
begin
  -- ── A session has to be a span ──────────────────────────────────────────────
  begin
    insert into challenge_sessions (mode_id, opens_at, closes_at)
    values ('challenge/four-keys', '2026-11-01 12:00+00', '2026-11-01 12:00+00');
    assert false, 'a session closing when it opens should have been refused';
  exception when check_violation then null;
  end;

  begin
    insert into challenge_sessions (mode_id, opens_at, closes_at)
    values ('challenge/four-keys', '2026-11-02 12:00+00', '2026-11-01 12:00+00');
    assert false, 'an inverted session should have been refused';
  exception when check_violation then null;
  end;

  -- ── The clash check ─────────────────────────────────────────────────────────
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', '2026-11-01 12:00+00', '2026-11-02 12:00+00')
  returning id into v_id;

  assert challenge_session_clashes(
    'challenge/four-keys', '2026-11-01 18:00+00', '2026-11-03 12:00+00'),
    'an overlapping span of the same challenge should clash';

  -- Half-open, matching `spanStatus` on the client and `isOpenMode` before it: a span
  -- starting exactly where another ends is the next session, not a clash.
  assert not challenge_session_clashes(
    'challenge/four-keys', '2026-11-02 12:00+00', '2026-11-03 12:00+00'),
    'a span meeting the last one end to end should not clash';

  -- A different challenge at the same time is two challenges on at once, which is fine.
  assert not challenge_session_clashes(
    'challenge/other', '2026-11-01 12:00+00', '2026-11-02 12:00+00'),
    'two different challenges should be free to overlap';

  -- A session must not find itself. Without `p_exclude`, editing a session without
  -- moving it would be refused for clashing with itself.
  assert not challenge_session_clashes(
    'challenge/four-keys', '2026-11-01 12:00+00', '2026-11-02 12:00+00', v_id),
    'a session being edited should not clash with itself';

  delete from challenge_sessions where id = v_id;
  raise notice 'challenge_sessions.sql: table and clash check OK';
end;
$$;

do $$
declare
  v_admin uuid;
  v_plain uuid;
  v_id    uuid;
begin
  select id into v_admin from profiles order by id limit 1;
  select id into v_plain from profiles order by id offset 1 limit 1;
  update profiles set role = 'admin' where id = v_admin;

  -- The RPCs read auth.uid(). Impersonate by setting the request claim the way
  -- PostgREST does, so `security definer` functions see a caller.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── An admin may plan, edit and cancel ──────────────────────────────────────
  v_id := plan_challenge_session(
    'challenge/four-keys', '2026-12-01 12:00+00', '2026-12-02 12:00+00');
  assert (select count(*) from challenge_sessions where id = v_id) = 1,
    'an admin should be able to plan a session';

  -- The challenge as well as the span: a session is one editable row.
  perform edit_challenge_session(
    v_id, 'challenge/other', '2026-12-03 12:00+00', '2026-12-04 12:00+00');
  assert (select mode_id from challenge_sessions where id = v_id) = 'challenge/other',
    'editing should move the session onto the new challenge';
  assert (select opens_at from challenge_sessions where id = v_id)
         = '2026-12-03 12:00+00'::timestamptz,
    'editing should move the start';

  -- ── Planning a clash is refused ─────────────────────────────────────────────
  begin
    perform plan_challenge_session(
      'challenge/other', '2026-12-03 18:00+00', '2026-12-05 12:00+00');
    assert false, 'planning over an existing session of the same challenge should fail';
  exception when others then
    assert sqlerrm like '%already booked%', 'wrong error: ' || sqlerrm;
  end;

  -- ── And so is editing *onto* one ────────────────────────────────────────────
  -- The check runs against the new mode_id, not the stored one. A version that read the
  -- stored one would let this through, which is the whole reason the parameter is there.
  declare
    v_second uuid;
  begin
    v_second := plan_challenge_session(
      'challenge/four-keys', '2026-12-10 12:00+00', '2026-12-11 12:00+00');
    begin
      perform edit_challenge_session(
        v_second, 'challenge/other', '2026-12-03 18:00+00', '2026-12-04 06:00+00');
      assert false, 'editing onto an already booked challenge should fail';
    exception when others then
      assert sqlerrm like '%already booked%', 'wrong error: ' || sqlerrm;
    end;
    perform cancel_challenge_session(v_second);
  end;

  -- ── Cancelling works whatever state the session is in ───────────────────────
  declare
    v_past uuid;
  begin
    v_past := plan_challenge_session(
      'challenge/gone', '2020-01-01 12:00+00', '2020-01-02 12:00+00');
    perform cancel_challenge_session(v_past);
    assert (select count(*) from challenge_sessions where id = v_past) = 0,
      'an expired session should still be cancellable';
  end;

  perform cancel_challenge_session(v_id);
  assert (select count(*) from challenge_sessions where id = v_id) = 0,
    'cancelling should delete the row';

  -- ── Nobody else may write ───────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain)::text, true);

  begin
    perform plan_challenge_session(
      'challenge/four-keys', '2026-12-01 12:00+00', '2026-12-02 12:00+00');
    assert false, 'a non-admin should not be able to plan a session';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;

  begin
    perform edit_challenge_session(
      gen_random_uuid(), 'challenge/four-keys',
      '2026-12-01 12:00+00', '2026-12-02 12:00+00');
    assert false, 'a non-admin should not be able to edit a session';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;

  begin
    perform cancel_challenge_session(gen_random_uuid());
    assert false, 'a non-admin should not be able to cancel a session';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;

  -- Leave the fixture as it was found.
  perform set_config('request.jwt.claims', null, true);
  update profiles set role = null where id = v_admin;

  raise notice 'challenge_sessions.sql: write guards OK';
end;
$$;

-- ── Who may read ──────────────────────────────────────────────────────────────
-- A public-read policy, because when a challenge is on is not a secret and phase two
-- reads this from the start screen. Checked as `anon`, which is the role a launch before
-- the anonymous sign-in actually has.
do $$
begin
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', '2027-01-01 12:00+00', '2027-01-02 12:00+00');
end;
$$;

-- `set role` rather than `set local role`: psql runs each statement in its own
-- transaction, so a LOCAL setting is reverted before the next statement sees it — which
-- left this whole block running as `postgres`, who bypasses RLS and so passed the read
-- and failed the write assertion for the wrong reason.
set role anon;
do $$
begin
  assert (select count(*) from challenge_sessions) >= 1,
    'anon should be able to read sessions';

  -- No delete policy and no delete grant, so this is refused at the privilege level
  -- rather than quietly matching no rows.
  begin
    delete from challenge_sessions;
    assert false, 'anon should not be able to delete a session';
  exception when insufficient_privilege then null;
  end;

  raise notice 'challenge_sessions.sql: read policy OK';
end;
$$;
reset role;

delete from challenge_sessions;
