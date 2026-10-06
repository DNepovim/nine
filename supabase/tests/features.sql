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
