-- A stage can now name a mode as well as a board.
--
-- Staging was difficulty-only: an achievement was cleared once on Easy, once on Hard and
-- once on Extreme. That is the wrong axis for the ones whose rule already fixes a board.
-- INTO THE DEEP asks for a hit on Extreme, so staging it by difficulty would ask the same
-- question of Easy and Hard, which nothing can ever answer. Its two stages are the two
-- Extreme boards: Accuracy and Speed.
--
-- Only the check constraint changes. `stage` is still half the primary key and still
-- text, so nothing about the table's shape or the client's upsert moves — this widens
-- what the column is allowed to say. Without it the insert is rejected outright and a
-- player's dive stays on their device for ever, since the sync queue has nothing to
-- distinguish "rejected for good" from "try again later".
--
-- Existing rows are untouched: every value already stored is one of the four this still
-- allows. What changes for them is on the client, where a boardless INTO THE DEEP is
-- read onto both modes rather than left unnameable — see `restage` in
-- lib/achievement-store.ts, which marks those rows unsynced so they arrive here under
-- their new names.

alter table achievements drop constraint achievements_stage_valid;

alter table achievements
  add constraint achievements_stage_valid
  check (stage in ('', 'easy', 'hard', 'extreme', 'accuracy', 'speed'));
