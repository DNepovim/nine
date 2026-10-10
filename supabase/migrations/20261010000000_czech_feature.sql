-- Czech goes behind a feature.
--
-- The catalog has shipped in the bundle since the day the toggle landed, so this adds no
-- language — it adds a door. Without the feature the LANGUAGE row is not in options and
-- the app is in English whatever the device has stored, which is what lets the Czech copy
-- be finished in front of players rather than behind a build.
--
-- A row here because `constants/features.ts` now holds a guard for the key, and a key
-- with no row resolves to off: without this the feature would be unreachable by anybody,
-- including whoever is meant to be reading the translation.

insert into features (key, active, note) values
  ('czech', true,
   'The LANGUAGE row in options, and so the only way into any language but English. The Czech catalog ships either way — what is gated is the switch, and a stored locale is ignored rather than cleared while the feature is not held.');

-- The same three rungs `dev` was seeded at: whoever can report on the translation can
-- read it. Ordinary players reach nothing here, which is the point.
insert into role_features (role_key, feature_key) values
  ('tester',    'czech'),
  ('developer', 'czech'),
  ('admin',     'czech');
