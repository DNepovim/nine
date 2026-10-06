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
