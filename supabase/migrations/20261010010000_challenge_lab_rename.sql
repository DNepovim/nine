-- `dev` becomes `challengeLab`, and `challenges` arrives.
--
-- The key `dev` named a door rather than a thing. The screen behind it is one section —
-- every challenge ever written, playable on demand outside its window with no board kept
-- — and the moment that screen holds a second, one key would be gating two unrelated
-- audiences. So the key names what it opens, and the DEV link on the intro now asks
-- whether *any* dev feature is reachable rather than asking this one. See `DEV_FEATURES`
-- in constants/features.ts.
--
-- `challenges` is the player-facing half: the link and the copy that will tell a player a
-- challenge is on. Created inactive and granted to nobody — nothing in the code reads it
-- yet. It exists so the next phase has a key to guard, and so the admin screen shows it
-- as a thing being prepared rather than as a thing missing.
--
-- ─── Why this is not `update features set key` ───────────────────────────────
-- `role_features.feature_key` and `user_features.feature_key` reference `features (key)`
-- with `on delete cascade` and **no `on update cascade`**. Updating the primary key would
-- therefore be refused outright, and a version of this that dropped the constraints first
-- would orphan every grant. So the key is inserted, the grants are copied, and the old row
-- is deleted — letting the cascade take what is left behind it.
--
-- The `user_features` copy carries `granted` with it, and that column is the one thing in
-- here that could go wrong silently. It is a tri-state by absence: true adds a feature the
-- role does not give, false takes one away that it does, and no row at all inherits. A
-- copy that filtered to the true rows, or that let `granted` default, would turn "this
-- tester must not see the dev screen" into "this tester sees the dev screen" — a change
-- nothing on any screen would look wrong about. Both directions, or neither.

-- ─── The new key, carrying the old one's switch ──────────────────────────────
insert into features (key, active, note)
select 'challengeLab', f.active,
       'The challenge lab: every challenge ever written, playable on demand outside its window with no board kept. Renamed from `dev`, which named the door rather than what is behind it — the DEV link now appears for anyone holding any dev feature, of which this is the first.'
  from features f
 where f.key = 'dev';

-- ─── The player-facing half, off for everyone ────────────────────────────────
insert into features (key, active, note) values
  ('challenges', false,
   'What a player sees of challenges: the link on the start screen and the copy around it. Inactive and in no stack — nothing in the code reads it yet. Here so the phase that writes that half has a key to guard rather than shipping it to everybody at once.');

-- ─── The grants, both tables ─────────────────────────────────────────────────
insert into role_features (role_key, feature_key)
select rf.role_key, 'challengeLab'
  from role_features rf
 where rf.feature_key = 'dev'
    on conflict do nothing;

-- `granted` copied, true rows and false rows alike. See the note above — this is the line
-- that matters.
insert into user_features (user_id, feature_key, granted)
select uf.user_id, 'challengeLab', uf.granted
  from user_features uf
 where uf.feature_key = 'dev'
    on conflict (user_id, feature_key) do update set granted = excluded.granted;

-- ─── And the old key goes, taking its own grants with it ─────────────────────
-- Both foreign keys are `on delete cascade`, so this is what clears the `dev` rows from
-- `role_features` and `user_features`. Deliberately not deleted by hand first: letting
-- the cascade do it is what proves the two were linked in the direction this migration
-- assumed.
delete from features where key = 'dev';
