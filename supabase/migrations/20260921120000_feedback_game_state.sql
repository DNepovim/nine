-- The run a message was written from, as the machine held it.
--
-- "It froze", "the target never expired", "the score jumped" — every report of that kind
-- is a guess until the run behind it can be read back. The mode, difficulty and score
-- columns say which board the player was on; this says what was actually in front of
-- them: the grid, the targets in flight, the lives, the streak, the clock.
--
-- Only a message written from the pause screen carries one. The intro and the game over
-- screen have no run in flight to describe, and the client sends null there rather than a
-- snapshot of nothing — see lib/feedback-state.ts.
--
-- Nothing in here is anything the player was not looking at when they wrote the message.
-- It is the same context the dialog already says goes with it, at full resolution.

alter table feedback add column game_state jsonb;

comment on column feedback.game_state is
  'The paused run as the state machine held it: { state, context }. Null for a message sent from anywhere but the pause screen.';
