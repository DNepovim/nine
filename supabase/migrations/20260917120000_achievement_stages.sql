-- Staged achievements — the board an achievement was cleared on.
--
-- A staged achievement is cleared once per board rather than once: Accuracy's and
-- Speed's score ladders, and the two "held a record for seven days" ones, ask the same
-- thing of Easy, Hard and Extreme, and a harder board never stands in for an easier one.
-- So the unit of earning is (achievement, stage), and `stage` joins the key.
--
-- Empty string rather than null for the unstaged case. A primary key cannot hold a
-- nullable column, and Postgres treats nulls as distinct in a unique index — so a null
-- stage would let the same unstaged achievement be inserted twice and break the
-- `ignoreDuplicates` upsert the client replays its whole queue through. The client keeps
-- null in its own types and maps at the boundary; see lib/achievement-sync.ts.
--
-- Written while the table is empty: `achievements` shipped hours ago and no client has
-- synced a row yet, so there is nothing to migrate.

alter table achievements add column stage text not null default '';

-- One of the game's three difficulties, or empty for unstaged. Checked rather than left
-- to the client: this column is half of an identity, and a typo would silently split one
-- achievement into two.
alter table achievements
  add constraint achievements_stage_valid
  check (stage in ('', 'easy', 'hard', 'extreme'));

alter table achievements drop constraint achievements_pkey;

alter table achievements
  add constraint achievements_pkey primary key (user_id, achievement_id, stage);
