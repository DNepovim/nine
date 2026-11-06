## Review

`/code-review` at high (schema touched) returned nine findings; with the spec's review focus
and the house pass, this is what became of them.

**Fixed (suite green, `challenge_state.sql` green).**

- **Removing the front of the queue left a day empty.** `set_challenge_state` re-packed with
  no floor, so survivors stayed put while the dialog promised they close up. It now keeps the
  earliest freed slot and hands it to the re-pack as `cancel_challenge_session` does; the test
  asserts the next session lands in the freed slot.
- **The vote's "last challenge" counted a pending challenge's running session** — one players
  cannot see or play, so nobody could vote. `next_vote_options` is restated in the same
  (unpushed) migration to look past it; the test covers it.
- **A failed read of `challenge_states` un-held every pending challenge on screen.** It now
  answers `null` and the callers keep what they had.
- **A pair save/remove that failed part-way left a stale screen.** After a failure the pair
  screen holds its buttons and says to go back and reopen.
- `TileDot` was a `switch` (house rule: value map) and `PlannedDot` a twin of the still dot:
  one still dot in `DOT_COLOR`'s colour now serves planned, live and pending.
- A raw `#FFFFFF` in `AdminPills` is now `ON_TINT_INK` in `constants/colors.ts`.

**Review focus, one by one.**

1. _Player reads of sessions_ — the policy covers direct selects and
   `open_sessions_with_leaders` the start screen. Of the other definers naming a session,
   `submit_session_score` / `record_session_run` take an id a player cannot learn for a hidden
   challenge, `session_board` and the summaries/places/winners are history of closed windows
   players played (kept on purpose), and `next_vote_options` was the one that mattered (fixed).
2. _Policy cost_ — the `has_feature` half runs only for rows of a pending challenge; a null
   caller makes it false, not an error (asserted for a non-admin).
3. _Votes when planned sessions are removed_ — `next_votes` cascades and
   `settle_next_vote()` runs after the re-pack.
4. _Race_ — every queue write here takes `lock_challenge_queue()`.
5. _Dot precedence vs the filter_ — one pass builds both; the pills add to the tile count
   (1 + 4 + 7 + 1 = 13 in the driven app).
6. _`admin-session.tsx` dead branches_ — gone; Knip and `tsc` clean.

**Left, deliberately.**

- **Pairs are cut positionally from a flat queue.** When a pair's first session opens, the rest
  re-pair one place off — the spec's named rabbit hole, accepted with "the pair is the vote". A
  stored pair id would stop the drift; its own item. Both sides use the same cut, so the only
  wrong outcome is a stale list around a noon, which the server refuses and the list re-reads.
- **`LAST RUN` is the last run inside the selected window**, as specified; worth a clearer
  label or an all-time figure if admins read it as "last seen".
- **The gallery re-reads ratings and votes after a state toggle** where only states and
  sessions changed. Harmless.
- **`move_challenge_session` is unused by the app now** (the planner moves pairs). It stays in
  the database; dropping it is a migration of its own.
- `submit_session_score` still accepts a pending challenge's _running_ session where one
  exists; pending means "not offered", not "cut off".

**Next.** Two migrations are unpushed (`…_stats_people_dates.sql`, `…_challenge_state.sql`)
and the code needs both before a deploy. No How to Play change. Nothing here is player-visible.

Shipped: `6693abd` on `main` (migrations `…_stats_people_dates` and `…_challenge_state` pushed to production first); the analytics dates and REFRESH went in beside it as `5a116b4`.
