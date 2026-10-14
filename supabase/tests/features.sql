-- Assertions over the feature tables, the resolve and the write guards.
-- Run with `pnpm db:test`, which resets the local database first.
--
-- Plain `assert` rather than pgTAP: this repo carries no SQL test dependency and one
-- assertion that raises is all a failing test has to do.

do $$
begin
  -- ── The seed reproduces today's floors ──────────────────────────────────────
  -- `dev` was floored at tester, so all three roles reach it — and
  -- …_challenge_lab_rename.sql carried every one of those rows onto the new key.
  assert (select count(*) from role_features where feature_key = 'challengeLab') = 3,
    'challengeLab should be in all three stacks';
  -- Nothing anywhere still names the old key. The foreign keys are `on delete cascade`,
  -- so deleting the `features` row is what cleared the grants — if any of these is
  -- non-zero the cascade did not run in the direction the migration assumed.
  assert not exists (select 1 from features      where key         = 'dev'),
    'the dev feature row should be gone';
  assert not exists (select 1 from role_features where feature_key = 'dev'),
    'no stack should still name dev';
  assert not exists (select 1 from user_features where feature_key = 'dev'),
    'no override should still name dev';

  -- `challenges` is seeded into every stack and hidden — the same arrangement
  -- `multiplayer` has. The stack says who could reach it; the switch says whether
  -- anybody does, and moving it is one tap rather than a migration.
  assert (select visibility from features where key = 'challenges') = 'hidden',
    'challenges should be hidden';
  assert (select count(*) from role_features where feature_key = 'challenges') = 3,
    'challenges should be seeded into every stack';
  -- `arcade` was floored at developer.
  assert exists (select 1 from role_features where role_key = 'developer' and feature_key = 'arcade'),
    'developer should hold arcade';
  assert exists (select 1 from role_features where role_key = 'admin' and feature_key = 'arcade'),
    'admin should hold arcade';
  assert not exists (select 1 from role_features where role_key = 'tester' and feature_key = 'arcade'),
    'tester should not hold arcade';
  -- `admin` was floored at admin, and only admin.
  assert (select count(*) from role_features where feature_key = 'admin') = 1,
    'only one stack should hold admin';

  -- `czech` is seeded at the same three rungs the challenge lab is: whoever can report on the
  -- translation can read it, and an ordinary player reaches neither.
  assert (select count(*) from role_features where feature_key = 'czech') = 3,
    'czech should be in all three stacks';
  assert (select visibility from features where key = 'czech') = 'private',
    'czech should be private — what is gated is who holds it, not the key';

  -- `multiplayer` is seeded into every stack but hidden, so moving the switch to
  -- private restores the tester floor in one move rather than four.
  assert (select count(*) from role_features where feature_key = 'multiplayer') = 3,
    'multiplayer should be seeded into every stack';
  assert (select visibility from features where key = 'multiplayer') = 'hidden',
    'multiplayer should be hidden';

  -- `rolePreview` is the admin stack's alone: the pills that start a preview are on a
  -- screen that already asks for `admin`, so a grant anywhere else would be a key to a
  -- door behind a locked door.
  assert (select count(*) from role_features where feature_key = 'rolePreview') = 1,
    'only one stack should hold rolePreview';
  assert exists (select 1 from role_features
                  where role_key = 'admin' and feature_key = 'rolePreview'),
    'admin should hold rolePreview';
  assert (select visibility from features where key = 'rolePreview') = 'private',
    'rolePreview should be private';

  -- ── The protected key, in both directions ──────────────────────────────────
  -- Hiding it locks every admin out of the only screen that could put it back; making
  -- it public puts the ADMIN link in front of every player. Neither is a thing the
  -- screen offers, and the constraint is what makes that true against a migration too.
  begin
    update features set visibility = 'hidden' where key = 'admin';
    assert false, 'hiding admin should have been refused';
  exception when check_violation then null;
  end;
  begin
    update features set visibility = 'public' where key = 'admin';
    assert false, 'making admin public should have been refused';
  exception when check_violation then null;
  end;

  -- ── Nothing ships public ───────────────────────────────────────────────────
  -- Public is a decision for the admin screen, the same way turning a feature on always
  -- was. Several assertions below count on no seeded feature reaching a roleless
  -- profile, and this is the line that says so out loud.
  assert not exists (select 1 from features where visibility = 'public'),
    'no feature should ship public';

  raise notice 'features.sql: tables and seed OK';
end;
$$;

do $$
declare
  v_plain uuid;
  v_test  uuid;
begin
  -- Two profiles from the seed: one with no role, one made a tester here.
  select id into v_plain from profiles order by id limit 1;
  select id into v_test  from profiles order by id offset 1 limit 1;
  update profiles set role = 'tester' where id = v_test;

  -- ── No role, no overrides: nothing ──────────────────────────────────────────
  assert not exists (select 1 from effective_features(v_plain)),
    'a profile with no role should reach nothing';

  -- ── A role gives its stack, minus whatever is hidden ────────────────────────
  -- Ordered by key, so the rename moved the first element as well as renaming it:
  -- 'challengeLab' sorts before 'czech' where 'dev' sorted after it.
  assert (select array_agg(k order by k) from effective_features(v_test) k)
         = array['challengeLab', 'czech'],
    'tester should reach challengeLab and czech and no more (multiplayer and challenges are hidden)';

  -- ── An override adds ────────────────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'arcade', true);
  assert has_feature(v_test, 'arcade'), 'a true override should add a feature';

  -- ── An override subtracts ───────────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'challengeLab', false);
  assert not has_feature(v_test, 'challengeLab'),
    'a false override should take away a feature the role gives';

  -- ── Hidden beats both ───────────────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'multiplayer', true);
  assert not has_feature(v_test, 'multiplayer'),
    'a hidden feature should not be reachable even by a true override';

  -- ── Removing the override row returns the role's answer ─────────────────────
  delete from user_features where user_id = v_test and feature_key = 'challengeLab';
  assert has_feature(v_test, 'challengeLab'),
    'deleting an override should fall back to the role';

  -- ── Public reaches past the stack ───────────────────────────────────────────
  -- `arcade` is in no stack this profile can reach — v_plain holds no role at all — so
  -- it is the key that proves public is doing the work rather than something else.
  update features set visibility = 'public' where key = 'arcade';
  assert has_feature(v_plain, 'arcade'),
    'a public feature should reach a profile with no role';

  -- ── And an override still beats it ──────────────────────────────────────────
  -- The one case worth a test of its own: a feature taken away from one person by hand
  -- stays taken away when it goes out to everybody. "Regardless of roles" is what public
  -- promises, and an override is not a role.
  insert into user_features (user_id, feature_key, granted) values (v_plain, 'arcade', false);
  assert not has_feature(v_plain, 'arcade'),
    'a revoked override should take away a public feature';
  delete from user_features where user_id = v_plain and feature_key = 'arcade';

  -- ── Hidden still beats public ───────────────────────────────────────────────
  update features set visibility = 'hidden' where key = 'arcade';
  assert not has_feature(v_plain, 'arcade'),
    'hiding a feature should take it back from everybody';

  -- ── Review Focus 2: no caller at all ────────────────────────────────────────
  -- `my_features()` runs on the first launch, before the anonymous sign-in has
  -- happened, so `auth.uid()` is null. The intro paints against this answer and must
  -- get an answer rather than an exception.
  --
  -- That answer is the public features and nothing else: a player who has not signed in
  -- yet is still everybody, and nothing private can come through, because the override
  -- subselect and the stack `exists` both answer false for a null id.
  update features set visibility = 'public' where key = 'arcade';
  assert (select array_agg(k) from effective_features(null) k) = array['arcade'],
    'a null user should reach the public features and only those';
  update features set visibility = 'private' where key = 'arcade';
  assert not exists (select 1 from effective_features(null)),
    'with nothing public, a null user should reach nothing, not raise';

  -- Leave the fixture as it was found, so later blocks start from the seed.
  delete from user_features where user_id = v_test;
  update profiles set role = null where id = v_test;

  raise notice 'features.sql: resolve OK';
end;
$$;

-- ─── What a role opens, asked about the role rather than about a person ──────
-- The preview's own resolve. Same table and same precedence as `effective_features`,
-- with the override clause left out because a role has none — so these assertions are
-- about exactly that difference.
do $$
declare
  v_plain uuid;
begin
  select id into v_plain from profiles order by id limit 1;

  -- The admin stack, resolved. `admin` and `rolePreview` are its own; the rest it shares
  -- with the two rungs below it. `multiplayer` and `challenges` are hidden and so are in
  -- nobody's answer however many stacks name them.
  assert (select array_agg(k order by k) from features_as_role('admin') k)
         = array['admin', 'arcade', 'challengeLab', 'czech', 'rolePreview'],
    'the admin role should open five features';

  -- A tester opens two, which is what the resolve says for a profile holding the role.
  assert (select array_agg(k order by k) from features_as_role('tester') k)
         = array['challengeLab', 'czech'],
    'the tester role should open challengeLab and czech';

  -- ── No role is a question, not a missing answer ─────────────────────────────
  -- Null is an ordinary player — all but a handful of profiles — and so resolves to the
  -- public features alone. Nothing ships public, so today that is nothing at all, and
  -- the preview of it agrees with what such a profile actually reaches.
  assert not exists (select 1 from features_as_role(null)),
    'no role should open nothing while nothing is public';
  assert not exists (select 1 from effective_features(v_plain)),
    'and that should be the same answer the roleless profile itself gets';

  -- ── Public reaches a preview too ────────────────────────────────────────────
  -- `challenges` ships hidden and in every stack, so making it public proves the clause
  -- rather than the stack: no role would have reached it a line ago.
  update features set visibility = 'public' where key = 'challenges';
  assert (select array_agg(k) from features_as_role(null) k) = array['challenges'],
    'a public feature should be in every role preview, including no role at all';
  update features set visibility = 'hidden' where key = 'challenges';

  -- ── An override is not a role ───────────────────────────────────────────────
  -- A preview wears a stack and nobody's exceptions. The row below would take `arcade`
  -- away from this person; it says nothing about what the role opens, and the preview
  -- must not read it.
  insert into user_features (user_id, feature_key, granted) values (v_plain, 'arcade', false);
  assert exists (select 1 from features_as_role('admin') k where k = 'arcade'),
    'a person''s override must not change what a role opens';
  delete from user_features where user_id = v_plain;

  raise notice 'features.sql: the role preview resolve OK';
end;
$$;

do $$
declare
  v_admin uuid;
  v_other uuid;
begin
  select id into v_admin from profiles order by id limit 1;
  select id into v_other from profiles order by id offset 1 limit 1;
  update profiles set role = 'admin' where id = v_admin;

  -- The RPCs read auth.uid(). Impersonate by setting the request claim the way
  -- PostgREST does, so `security definer` functions see a caller.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── An ordinary write works ─────────────────────────────────────────────────
  perform set_user_role(v_other, 'tester');
  assert (select role from profiles where id = v_other) = 'tester',
    'an admin should be able to set a role';

  perform set_user_feature(v_other, 'arcade', true);
  assert has_feature(v_other, 'arcade'), 'an admin should be able to grant a feature';

  perform reset_user_features(v_other);
  assert not has_feature(v_other, 'arcade'), 'reset should drop every override';

  -- ── Review Focus 4: the override route out of admin ─────────────────────────
  -- A guard watching only set_user_role would let both of these through.
  begin
    perform set_user_feature(v_admin, 'admin', false);
    assert false, 'overriding your own admin off should have been refused';
  exception when others then
    assert sqlerrm like '%take admin away from you%', 'wrong error: ' || sqlerrm;
  end;

  -- Resetting is fine while admin comes from the role: the overrides go, the role
  -- still answers.
  perform set_user_feature(v_admin, 'arcade', true);
  perform reset_user_features(v_admin);
  assert has_feature(v_admin, 'admin'), 'reset should not have touched a role-given admin';

  -- Now make admin come from an override instead, and reset must refuse. The override
  -- is granted BEFORE the role is taken away — the other order would leave the caller
  -- without admin between the two statements, and `require_admin` would refuse the
  -- grant itself rather than the thing under test.
  perform set_user_feature(v_admin, 'admin', true);
  update profiles set role = 'tester' where id = v_admin;
  begin
    perform reset_user_features(v_admin);
    assert false, 'resetting away your only source of admin should have been refused';
  exception when others then
    assert sqlerrm like '%take admin away from you%', 'wrong error: ' || sqlerrm;
  end;
  update profiles set role = 'admin' where id = v_admin;
  delete from user_features where user_id = v_admin;

  -- ── Editing your own role's stack ───────────────────────────────────────────
  begin
    perform set_role_feature('admin', 'admin', false);
    assert false, 'taking admin out of your own stack should have been refused';
  exception when others then
    assert sqlerrm like '%take admin away from you%', 'wrong error: ' || sqlerrm;
  end;

  -- ── A role somebody holds cannot be deleted ─────────────────────────────────
  begin
    perform delete_role('tester');
    assert false, 'deleting a held role should have been refused';
  exception when others then
    assert sqlerrm like '%still held by 1 person%', 'wrong error: ' || sqlerrm;
  end;

  -- ── Roles can be made, renamed and dropped ──────────────────────────────────
  perform create_role('streamer', 'STREAMER');
  perform rename_role('streamer', 'STREAMERS');
  assert (select label from roles where key = 'streamer') = 'STREAMERS', 'rename failed';
  perform set_role_feature('streamer', 'arcade', true);
  perform delete_role('streamer');
  assert not exists (select 1 from roles where key = 'streamer'), 'delete failed';
  assert not exists (select 1 from role_features where role_key = 'streamer'),
    'deleting a role should cascade its stack';

  -- ── A non-admin is refused ──────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  begin
    perform set_user_role(v_admin, null);
    assert false, 'a non-admin should not be able to write a role';
  exception when others then
    assert sqlerrm like '%not an admin%', 'wrong error: ' || sqlerrm;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- ── Review Focus 3: overrides without a role still appear ───────────────────
  perform set_user_role(v_other, null);
  perform set_user_feature(v_other, 'arcade', true);
  assert exists (select 1 from admin_people() p where p.id = v_other),
    'a person with overrides but no role must still be listed';
  assert (select p.has_overrides from admin_people() p where p.id = v_other),
    'that person should be marked as carrying overrides';
  assert (select p.feature_count from admin_people() p where p.id = v_other) = 1,
    'feature_count should be what they actually reach';

  perform reset_user_features(v_other);
  update profiles set role = null where id = v_admin;

  raise notice 'features.sql: writes and guards OK';
end;
$$;
