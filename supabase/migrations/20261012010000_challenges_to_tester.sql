-- `challenges` reaches testers.
--
-- Phase one created the key with no grants and no switch: there was nothing behind it,
-- and a door onto an empty room is worse than no door. There is something behind it now
-- — the card on the start screen, the dialog, the standings and a chapter of the guide
-- — so it is stacked at the same three rungs every other feature in development sits at.
--
-- `active` stays **false**. The stack says who *could* reach it; the switch says whether
-- anybody does. Turning challenges on for players is one tap on the admin screen when
-- the copy has been read and a session has been planned, and it is not a code change.
insert into role_features (role_key, feature_key) values
  ('tester',    'challenges'),
  ('developer', 'challenges'),
  ('admin',     'challenges')
on conflict do nothing;
