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
  -- Not an admin whatever the local stack's fixtures made of them.
  update profiles set role = null where id = v_plain;

  -- The RPCs read auth.uid(). Impersonate by setting the request claim the way
  -- PostgREST does, so `security definer` functions see a caller.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── An admin may plan, edit and cancel ──────────────────────────────────────
  -- Planning takes a challenge and nothing else: the queue says when.
  delete from challenge_sessions;
  v_id := plan_challenge_session('challenge/four-keys');
  assert (select count(*) from challenge_sessions where id = v_id) = 1,
    'an admin should be able to plan a session';
  assert (select opens_at from challenge_sessions where id = v_id)
         = challenge_slot_at_or_after(now()),
    'the first session into an empty queue should open at the next slot';

  -- Editing re-points the challenge and leaves the times where the queue put them.
  declare
    v_opens timestamptz := (select opens_at from challenge_sessions where id = v_id);
  begin
    perform edit_challenge_session(v_id, 'challenge/other');
    assert (select mode_id from challenge_sessions where id = v_id) = 'challenge/other',
      'editing should move the session onto the new challenge';
    assert (select opens_at from challenge_sessions where id = v_id) = v_opens,
      'editing should leave the start alone';
  end;

  -- ── The same challenge twice is two airings, not a clash ────────────────────
  declare
    v_second uuid;
  begin
    v_second := plan_challenge_session('challenge/other');
    assert (select opens_at from challenge_sessions where id = v_second)
           = ((((select opens_at from challenge_sessions where id = v_id)
                 at time zone 'Europe/Prague')::date
               + case extract(isodow from (select opens_at from challenge_sessions
                                            where id = v_id) at time zone 'Europe/Prague')
                   when 1 then 3 else 4 end) + time '12:00')
             at time zone 'Europe/Prague',
      'a second booking should join the queue on the next slot, Monday to Thursday or back';
    perform cancel_challenge_session(v_second);
  end;

  -- ── Cancelling works whatever state the session is in ───────────────────────
  declare
    v_past uuid;
  begin
    insert into challenge_sessions (mode_id, opens_at, closes_at)
    values ('challenge/gone', '2020-01-01 12:00+00', '2020-01-02 12:00+00')
    returning id into v_past;
    begin
      perform edit_challenge_session(v_past, 'challenge/other');
      assert false, 're-pointing a closed session should have been refused';
    exception when raise_exception then
      assert sqlerrm like '%has opened%', format('refused for the wrong reason: %s', sqlerrm);
    end;
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
    perform plan_challenge_session('challenge/four-keys');
    assert false, 'a non-admin should not be able to plan a session';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;

  begin
    perform edit_challenge_session(gen_random_uuid(), 'challenge/four-keys');
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

-- ─── The teaser, and the three ways a figure is resolved ─────────────────────
--
-- Added after `verify` found the third arm missing. These assert the *resolve*, which is
-- the thing no TypeScript test can reach: `open_sessions_with_leaders` coalesces the
-- session's own figure, then the general one, then a literal, and the client multiplies
-- whatever arrives. A null reaching it becomes nought in JavaScript rather than an error,
-- so every teaser in the app would switch off with nothing raised anywhere.

do $$
declare
  v_id      uuid;
  v_minutes int;
begin
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', now() + interval '2 days', now() + interval '3 days')
  returning id into v_id;

  -- ── The general figure, where the session says nothing ──────────────────────
  select teaser_minutes into v_minutes
    from open_sessions_with_leaders() where id = v_id;
  assert v_minutes = 2160,
    format('a session with no teaser of its own should take the general 2160, got %s',
           coalesce(v_minutes::text, 'null'));

  -- ── Its own figure, where it has one ────────────────────────────────────────
  update challenge_sessions set teaser_minutes = 60 where id = v_id;
  select teaser_minutes into v_minutes
    from open_sessions_with_leaders() where id = v_id;
  assert v_minutes = 60, 'a session with its own teaser should beat the general figure';

  -- Nought is a real answer — no teaser at all — and must not be read as "unset" by a
  -- coalesce that treats it like one.
  update challenge_sessions set teaser_minutes = 0 where id = v_id;
  select teaser_minutes into v_minutes
    from open_sessions_with_leaders() where id = v_id;
  assert v_minutes = 0, 'a teaser of nought should survive the resolve as nought';

  -- ── The literal, where the settings row is not there to be read ─────────────
  --
  -- The regression `verify` found. Nothing in the app deletes this row, which is exactly
  -- why it is worth asserting: the failure is silent and would be found by a player
  -- noticing a card never appeared.
  update challenge_sessions set teaser_minutes = null where id = v_id;
  delete from settings where key = 'teaser_minutes';
  select teaser_minutes into v_minutes
    from open_sessions_with_leaders() where id = v_id;
  assert v_minutes is not null,
    'the resolve must never hand the client a null teaser';
  assert v_minutes = 2160,
    format('with no settings row the resolve should fall back to 2160, got %s', v_minutes);

  insert into settings (key, int_value) values ('teaser_minutes', 2160);

  -- ── A negative general figure is refused at both doors ──────────────────────
  --
  -- The other half of the silent-failure pair above. A negative teaser makes
  -- `teaserOpensAt` compute `opensAt + X`, and a teaser needs both `now < opensAt` and
  -- `now >= teaserOpensAt` — which can then never both hold, so every teaser in the app
  -- quietly stops appearing. Floored by a constraint so it holds against any caller, and
  -- named by the RPC so a person gets a sentence.
  begin
    update settings set int_value = -1 where key = 'teaser_minutes';
    assert false, 'a negative general teaser should have been refused';
  exception when check_violation then null;
  end;

  delete from challenge_sessions where id = v_id;

  raise notice 'challenge_sessions.sql: teaser resolve OK';
end;
$$;

-- ─── What a live window allows, and what it does not ─────────────────────────
--
-- The guards `verify` had to exercise by hand. Impersonating an admin the way
-- features.sql does, because `require_admin` runs whatever role is calling — the first
-- draft of this block called the functions as the owner and every `exception when
-- raise_exception` swallowed "not authenticated" and read it as the guard refusing. So
-- each handler asserts on the *message*: a test that cannot say why something was
-- refused is a test that passes when the refusal is wrong.

do $$
declare
  v_admin  uuid;
  v_was    text;
  v_live   uuid;
  v_past   uuid;
  v_before int;
begin
  select id, role into v_admin, v_was from profiles order by id limit 1;
  update profiles set role = 'admin' where id = v_admin;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_live;

  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_live, v_admin, 4242, 9, 'hard', now());

  -- ── Deleting is the asymmetry: a live session goes nowhere even unplayed ────
  --
  -- Editing an untouched booking corrects it; deleting it takes the card out from under
  -- whoever is looking at it. So `cancel` keeps the liveness guard that `edit` does not.
  -- Asserted on a fresh live session with an empty board, which is exactly the case the
  -- two rules disagree about.
  declare
    v_fresh uuid;
  begin
    insert into challenge_sessions (mode_id, opens_at, closes_at)
    values ('challenge/nine-lives', now() - interval '1 hour', now() + interval '1 hour')
    returning id into v_fresh;
    begin
      perform cancel_challenge_session(v_fresh);
      assert false, 'deleting a live session should have been refused';
    exception when raise_exception then
      assert sqlerrm like '%is live%', format('refused for the wrong reason: %s', sqlerrm);
    end;
    delete from challenge_sessions where id = v_fresh;
  end;

  -- ── Nor is one anybody has scored on, whatever its status ───────────────────
  --
  -- The half that matters: most boards belong to sessions that have already ended, and
  -- `session_scores` cascades on delete.
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', now() - interval '3 days', now() - interval '2 days')
  returning id into v_past;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  values (v_past, v_admin, 100, 1, 'easy', now());

  begin
    perform cancel_challenge_session(v_past);
    assert false, 'deleting an expired session with a board should have been refused';
  exception when raise_exception then
    assert sqlerrm like '%already scored on it%',
      format('refused for the wrong reason: %s', sqlerrm);
  end;

  -- …but an unplayed one still goes, in any status. An admin who booked the wrong thing
  -- can still take it away; a guard stopping them would preserve the mistake.
  delete from session_scores where session_id = v_past;
  perform cancel_challenge_session(v_past);
  assert not exists (select 1 from challenge_sessions where id = v_past),
    'an unplayed expired session should still be deletable';

  -- ── Closing early shuts the window and keeps the board ──────────────────────
  select count(*) into v_before from session_scores where session_id = v_live;
  assert v_before > 0, 'the close-early assertion needs a board to be about';

  perform close_challenge_session_early(v_live);
  assert (select closes_at from challenge_sessions where id = v_live) <= now(),
    'closing early should put the end at or before now';
  assert (select count(*) from session_scores where session_id = v_live) = v_before,
    'closing early must not touch the board';
  assert not exists (select 1 from open_sessions_with_leaders() where id = v_live),
    'a closed session should leave the start screen''s read';

  -- ── Extending is the third door into closes_at, and takes the same lock ─────
  begin
    perform extend_challenge_session(v_live, 60);
    assert false, 'extending a closed session should have been refused';
  exception when raise_exception then
    assert sqlerrm like '%already closed%', format('refused for the wrong reason: %s', sqlerrm);
  end;

  delete from session_scores where session_id = v_live;
  delete from challenge_sessions where id = v_live;

  -- Leave the fixture as it was found, the way features.sql does and for the same
  -- reason: these files share one database and run in name order, so a role left behind
  -- here is a role features.sql finds on the profile it asserts has none. That is not a
  -- hypothetical — it is what the first draft of this block did.
  update profiles set role = v_was where id = v_admin;

  raise notice 'challenge_sessions.sql: live-window guards OK';
end;
$$;

do $$
declare
  v_admin  uuid;
  v_was    text;
  v_a      uuid;
  v_closes timestamptz;
begin
  -- Self-contained rather than leaning on the block above having left an admin behind:
  -- the block above now puts the role back, and a test that depends on another test's
  -- leftovers breaks the moment either is reordered.
  select id, role into v_admin, v_was from profiles order by id limit 1;
  update profiles set role = 'admin' where id = v_admin;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- An extension that would run into the queue pushes the queue rather than being
  -- refused: the queue is the server's to time, so it moves out of the way.
  delete from challenge_sessions;
  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/four-keys', now() - interval '1 hour', now() + interval '1 hour')
  returning id into v_a;
  perform plan_challenge_session('challenge/four-keys');

  -- Nought and below are refused before anything is read.
  begin
    perform extend_challenge_session(v_a, 0);
    assert false, 'an extension of nought should have been refused';
  exception when raise_exception then
    assert sqlerrm like '%must be positive%', format('refused for the wrong reason: %s', sqlerrm);
  end;

  -- Any length is taken, to the minute, and leaves the mark the card reads.
  select closes_at into v_closes from challenge_sessions where id = v_a;
  perform extend_challenge_session(v_a, 3 * 24 * 60);
  assert (select closes_at from challenge_sessions where id = v_a)
         = v_closes + interval '3 days',
    'an extension should move the end by exactly what was asked';
  assert (select extended_at from challenge_sessions where id = v_a) is not null,
    'an extended session should carry the mark the card reads';
  assert (select opens_at from challenge_sessions where opens_at > now())
         >= v_closes + interval '3 days' + interval '23 hours',
    'the queued session should have been pushed past the extended end and a day of rest';

  delete from challenge_sessions;
  update profiles set role = v_was where id = v_admin;

  raise notice 'challenge_sessions.sql: extend guards OK';
end;
$$;

-- ── The queue ─────────────────────────────────────────────────────────────────
--
-- The slot arithmetic against pinned instants, then the queue writes against `now()`,
-- since plan, move and cancel take no clock of their own. Every expected time is worked
-- out from the first slot rather than written as a literal, so the block holds whatever
-- day the suite runs on.
do $$
declare
  v_admin uuid;
  v_was   text;
  v_live  uuid;
  v_a     uuid;
  v_b     uuid;
  v_c     uuid;
  v_slot0 timestamptz;
  v_slot1 timestamptz;
  v_slot2 timestamptz;
begin
  -- ── The slot ────────────────────────────────────────────────────────────────
  -- Monday and Thursday noon (Prague). 2026-11-02 is a Monday, the 3rd a Tuesday.
  -- A Tuesday-noon close waits for Thursday.
  assert challenge_queue_slot('2026-11-03 11:00+00', '2026-11-03 11:05+00')
         = '2026-11-05 11:00+00', 'a Tuesday close should open the Thursday noon';
  -- A Friday-noon close waits over the weekend for Monday.
  assert challenge_queue_slot('2026-11-06 11:00+00', '2026-11-06 11:05+00')
         = '2026-11-09 11:00+00', 'a Friday close should open the Monday noon';
  -- Across the autumn clock change (25 October) Monday is still noon: 11:00 UTC before,
  -- 11:00 UTC after only because CET is one hour behind CEST's 10:00.
  assert challenge_queue_slot('2026-10-23 10:00+00', '2026-10-23 10:05+00')
         = '2026-10-26 11:00+00', 'a slot after the autumn change should be noon Prague';
  assert challenge_queue_slot('2027-03-26 11:00+00', '2027-03-26 11:05+00')
         = '2027-03-29 10:00+00', 'a slot after the spring change should be noon Prague';
  -- An end past a Thursday noon pushes to the Monday after.
  assert challenge_queue_slot('2026-11-05 13:00+00', '2026-11-05 13:05+00')
         = '2026-11-09 11:00+00', 'an end past a slot should push to the next one';
  -- A close long past falls forward to the next slot to come, and so does no close at all.
  assert challenge_queue_slot('2026-01-01 11:00+00', '2026-11-03 13:00+00')
         = '2026-11-05 11:00+00', 'a stale end should fall forward to the next slot';
  assert challenge_queue_slot(null, '2026-11-03 09:00+00') = '2026-11-05 11:00+00',
    'with nothing ever opened the first slot is the next Monday or Thursday noon';

  -- ── The writes ──────────────────────────────────────────────────────────────
  select id, role into v_admin, v_was from profiles order by id limit 1;
  update profiles set role = 'admin' where id = v_admin;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  delete from challenge_sessions;

  insert into challenge_sessions (mode_id, opens_at, closes_at)
  values ('challenge/live', now() - interval '1 hour', now() + interval '23 hours')
  returning id into v_live;
  v_slot0 := challenge_queue_slot(now() + interval '23 hours', now());

  v_slot1 := challenge_slot_at_or_after(v_slot0 + interval '1 day');
  v_slot2 := challenge_slot_at_or_after(v_slot1 + interval '1 day');

  v_a := plan_challenge_session('challenge/a');
  v_b := plan_challenge_session('challenge/b');
  v_c := plan_challenge_session('challenge/c');

  -- Each a slot after the one before, noon to noon.
  assert (select opens_at from challenge_sessions where id = v_a) = v_slot0,
    'the first into the queue should take the first slot';
  assert (select opens_at from challenge_sessions where id = v_c)
         = v_slot2, 'the third should be two slots after the first';
  assert (select opens_at from challenge_sessions where id = v_b) = v_slot1,
    'the second should be the slot after the first';
  assert (select closes_at from challenge_sessions where id = v_c)
         = (((v_slot2 at time zone 'Europe/Prague')::date + 1) + time '12:00')
           at time zone 'Europe/Prague',
    'a queued session should close at noon the next day';

  -- Removing one closes the gap behind it.
  perform cancel_challenge_session(v_a);
  assert (select opens_at from challenge_sessions where id = v_b) = v_slot0,
    'removing the first should move the next into its slot';
  assert (select opens_at from challenge_sessions where id = v_c) = v_slot1,
    'removing the first should move the third up a slot';

  -- Extending past the rest pushes the queue; closing early afterwards must not pull it
  -- back. The anchor falls back to the original twenty-four hours, but the queue is
  -- floored at where it already starts.
  perform extend_challenge_session(v_live, 2 * 24 * 60);
  declare
    v_pushed timestamptz := (select opens_at from challenge_sessions where id = v_c);
  begin
    assert v_pushed > v_slot0, 'a long extension should push the queue';
    perform close_challenge_session_early(v_live);
    assert (select opens_at from challenge_sessions where id = v_c) = v_pushed,
      'closing early after an extension should leave the queue where it was pushed';

    -- Deleting the closed, unplayed session takes the anchor away entirely. The queue
    -- still stays put: only a queued row hands its slot on.
    perform cancel_challenge_session(v_live);
    assert (select opens_at from challenge_sessions where id = v_c) = v_pushed,
      'deleting an opened session should not pull the queue forward';
  end;

  delete from challenge_sessions;
  perform set_config('request.jwt.claims', null, true);
  update profiles set role = v_was where id = v_admin;

  raise notice 'challenge_sessions.sql: the queue OK';
end;
$$;

-- ── The next session, booked when nobody did ─────────────────────────────────
--
-- `p_now` is pinned throughout, so the arithmetic is asserted against fixed instants
-- rather than against whatever day the suite happens to run on.
do $$
declare
  v_id   uuid;
  v_user uuid;
  v_next challenge_sessions%rowtype;
begin
  delete from challenge_sessions;

  assert plan_next_challenge_session('2026-11-03 12:00+00') is null,
    'with nothing ever booked there is no pool, so nothing should be booked';

  -- Three challenges have run; habit longest ago, four-keys last, closing at noon Prague
  -- on the 3rd (11:00 UTC, the clocks having gone back on 25 October).
  insert into challenge_sessions (mode_id, opens_at, closes_at, measure) values
    ('challenge/habit',     '2026-10-28 11:00+00', '2026-10-29 11:00+00', 'time'),
    ('challenge/drift',     '2026-10-30 11:00+00', '2026-10-31 11:00+00', 'score'),
    ('challenge/four-keys', '2026-11-02 11:00+00', '2026-11-03 11:00+00', 'score');

  -- While one is live, it is planned.
  assert plan_next_challenge_session('2026-11-03 10:00+00') is null,
    'a live session should count as planned';

  v_id := plan_next_challenge_session('2026-11-03 11:05+00');
  assert v_id is not null, 'with nothing live or to come, a session should be booked';
  select * into v_next from challenge_sessions where id = v_id;

  assert v_next.opens_at = '2026-11-05 11:00+00',
    format('should open at the next Thursday noon, got %s', v_next.opens_at);
  assert v_next.closes_at = '2026-11-06 11:00+00', 'should close at noon the next day';
  assert v_next.mode_id = 'challenge/habit',
    'should pick the challenge that has gone longest without a session';
  assert v_next.measure = 'time', 'should carry the measure the challenge was booked with';
  assert v_next.created_by is null, 'nobody planned it, and the row should say so';
  assert v_next.alt_mode_id = 'challenge/drift' and v_next.alt_measure = 'score',
    'should fill the second candidate with the next longest unseen challenge';
  assert v_next.first_mode_id = 'challenge/habit', 'the first candidate should lead the ballot';

  assert plan_next_challenge_session('2026-11-03 11:10+00') is null,
    'the session just booked is planned, so a second run should book nothing';

  -- Run exactly at the close: still a day of rest before it, not end to end.
  delete from challenge_sessions where id = v_id;
  v_id := plan_next_challenge_session('2026-11-03 11:00+00');
  assert (select opens_at from challenge_sessions where id = v_id) = '2026-11-05 11:00+00',
    'a run at the instant of a Tuesday close should open the Thursday noon';

  -- A close long past: the next noon to come, counted from the run, not the close.
  delete from challenge_sessions where id = v_id;
  v_id := plan_next_challenge_session('2026-11-20 09:00+00');
  assert (select opens_at from challenge_sessions where id = v_id) = '2026-11-23 11:00+00',
    'a stale close should fall forward to the next slot in Prague';

  -- Once anything has been played, a challenge nobody played in sixty days is out of the
  -- pool — habit is the oldest, but only drift and four-keys have scores.
  delete from challenge_sessions where id = v_id;
  select id into v_user from profiles order by id limit 1;
  insert into session_scores (session_id, user_id, best_score, hits, difficulty, updated_at)
  select id, v_user, 100, 1, 'easy', now()
    from challenge_sessions where mode_id in ('challenge/drift', 'challenge/four-keys');
  v_id := plan_next_challenge_session('2026-11-03 11:05+00');
  assert (select mode_id from challenge_sessions where id = v_id) = 'challenge/drift',
    'a challenge unplayed in sixty days should drop out while others are played';
  assert (select alt_mode_id from challenge_sessions where id = v_id) = 'challenge/four-keys',
    'the second candidate should come from the same pool';

  raise notice 'challenge_sessions.sql: next session booked on its own OK';
end;
$$;

delete from challenge_sessions;
