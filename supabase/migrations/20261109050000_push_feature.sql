-- Push goes behind a feature.
--
-- The consent step, the NOTIFICATIONS row in options and every call to the subscription
-- RPCs sit behind `push`. Seeded into the three working stacks and hidden, the same
-- arrangement `challenges` had: the stack says who could reach it, the visibility says
-- whether anybody does, and making it public is one tap on the admin screen.

insert into features (key, visibility, note) values
  ('push', 'hidden',
   'Notifications while the app is closed: the second step of the first-launch consent, the NOTIFICATIONS row in options, and the subscription calls behind them. One trigger so far — a board you held being taken.');

insert into role_features (role_key, feature_key) values
  ('tester',    'push'),
  ('developer', 'push'),
  ('admin',     'push');
