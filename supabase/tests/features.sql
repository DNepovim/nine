-- Assertions over the feature tables, the resolve and the write guards.
-- Run with `pnpm db:test`, which resets the local database first.
--
-- Plain `assert` rather than pgTAP: this repo carries no SQL test dependency and one
-- assertion that raises is all a failing test has to do.

do $$
begin
  -- ── The seed reproduces today's floors ──────────────────────────────────────
  -- `dev` was floored at tester, so all three roles reach it.
  assert (select count(*) from role_features where feature_key = 'dev') = 3,
    'dev should be in all three stacks';
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

  -- `multiplayer` is seeded into every stack but switched off, so flipping `active`
  -- restores the tester floor in one move rather than four.
  assert (select count(*) from role_features where feature_key = 'multiplayer') = 3,
    'multiplayer should be seeded into every stack';
  assert (select active from features where key = 'multiplayer') = false,
    'multiplayer should be inactive';

  -- ── The protected key ───────────────────────────────────────────────────────
  begin
    update features set active = false where key = 'admin';
    assert false, 'deactivating admin should have been refused';
  exception when check_violation then null;
  end;

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

  -- ── A role gives its stack, minus whatever is inactive ──────────────────────
  assert (select array_agg(k order by k) from effective_features(v_test) k) = array['dev'],
    'tester should reach dev and only dev (multiplayer is inactive)';

  -- ── An override adds ────────────────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'arcade', true);
  assert has_feature(v_test, 'arcade'), 'a true override should add a feature';

  -- ── An override subtracts ───────────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'dev', false);
  assert not has_feature(v_test, 'dev'),
    'a false override should take away a feature the role gives';

  -- ── The master switch beats both ────────────────────────────────────────────
  insert into user_features (user_id, feature_key, granted) values (v_test, 'multiplayer', true);
  assert not has_feature(v_test, 'multiplayer'),
    'an inactive feature should not be reachable even by a true override';

  -- ── Removing the override row returns the role's answer ─────────────────────
  delete from user_features where user_id = v_test and feature_key = 'dev';
  assert has_feature(v_test, 'dev'), 'deleting an override should fall back to the role';

  -- ── Review Focus 2: no caller at all ────────────────────────────────────────
  -- `my_features()` runs on the first launch, before the anonymous sign-in has
  -- happened, so `auth.uid()` is null. The intro paints against this answer and must
  -- get an empty set rather than an exception.
  assert not exists (select 1 from effective_features(null)),
    'a null user should reach nothing, not raise';

  -- Leave the fixture as it was found, so later blocks start from the seed.
  delete from user_features where user_id = v_test;
  update profiles set role = null where id = v_test;

  raise notice 'features.sql: resolve OK';
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
