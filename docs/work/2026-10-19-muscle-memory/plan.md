# The same nine, every run — Plan

Spec: docs/work/2026-10-19-muscle-memory/spec.md

## Tasks

- [x] 1. `lib/drill.ts` + `lib/drill.test.ts` — `drillValues` (the seeded nine) and `drillPlaces` (the seeded non-overlapping scatter, and the card size that makes nine fit)
- [x] 2. `modes/types.ts`, `modes/rules.ts` — `spawn.drill` and `scoring.measure`, their defaults and their lines in the patch; `modes/rules.test.ts` — `drillSize` split out as its own export; the literal nine asserted with `toEqual`, not a snapshot, so `vitest -u` cannot rewrite the contract
- [x] 3. `modes/registry.ts`, `modes/index.ts` — `measureOf`, and the exports
- [x] 4. `modes/types.ts` — `ShotKind` gains `'chain'`
- [x] 5. `hooks/use-target-spawner.ts` — deal from the drill by targets **dealt**; retry a deal the board refused; stop when spent
- [x] 6. `machines/game.ts` + `machines/game.test.ts` — a run ends when the drill is spent and the board is clear; the two `lives <= 0` guards became one `runOver` helper, so the two ways a run can end are named in one place
- [x] 7. `components/game/target-card.tsx` — passes `size` through; `pie-countdown.tsx` already took one and scales its whole drawing off it, so it needed nothing
- [x] 8. `app/(tabs)/index.tsx` + `hooks/use-displayed-targets.ts` — the drill's places and size live in the display hook, recomputed on every layout so a card placed before the board was measured is not stuck there; `clocked` read off `rules.clock.countsDown`
- [x] 9. The chain beam — `lib/strike-shot.ts`, `hooks/use-strike-shots.ts`, and the remembered point on the game screen
- [x] 10. `supabase/migrations/20261019000000_session_measure.sql` — `challenge_sessions.measure`, `session_scores.time_ms`, the three RPCs, `prevent_session_downgrade`; `supabase/tests/session_scores.sql`
- [x] 11. `lib/admin/sessions.ts` — the measure is resolved from the challenge in the one place a booking is written, so `admin-session.tsx` needed no change and the form grew no field
- [x] 12. `lib/leaderboard.ts`, `lib/session-board.ts` — carry `timeMs` through the read and the write
- [x] 13. `lib/local-scores.ts`, `lib/score-submission.ts`, `hooks/use-score-submission.ts` + `lib/local-scores.test.ts` — carry the time; keep the better row by the slot's measure. The mid-run record post deliberately sends no time: the run is not over
- [x] 14. `score-columns.tsx`, `score-row.tsx`, `tab-panel.tsx`, `leaderboard-rows.ts`, `challenge-modal.tsx`, `session-standings.tsx` — the TIME column, on a time-measured board only. Added `formatRaceTime` (tenths) in `lib/duration.ts`: whole seconds would tie half the field on a nine-target run
- [x] 15. `modes/challenges/catalog.ts` + `challenges.test.ts` — the MUSCLE MEMORY entry — **pulled forward**, before task 6: the machine test needs a registered drilled mode to drive
- [x] 16. Copy — the Czech label is PAMĚŤ RUKY, not SVALOVÁ PAMĚŤ: the wordmark pins 56px letters and wraps mid-word past six, and SVALOVÁ is seven. TIME was already in the catalog from the run stats
- [x] 17. `CLAUDE.md` rows for **drill** and **measure**; `.claude/skills/challenge/SKILL.md` gains the **modulations** section

## Verification log

_(verify fills this in)_

## Build notes

### What differed from the spec

- **Three of the four "new" behaviours already existed.** `clock.countsDown: false` is
  the tutorial's own field and does both jobs the challenge wanted — no ring armed, and
  `clockLeft` scoring every hit as though no time had passed — and the top bar already
  draws `lives.count` hearts, so infinite lives draws none. The spec predicted this; it
  held. "No ring, no hearts, nothing expires" cost three lines in the catalog.
- **The measure is a column, not an argument.** Decided in the spec and worth restating
  because it removed a whole rabbit hole: `open_sessions_with_leaders` answers for every
  open session in one call and so cannot be told per-call which way to rank. Stamping the
  row at booking time makes the intro's card name the fastest player on a race for free.
- **`formatRaceTime` is new and the spec did not name it.** `formatGameTime` gives whole
  seconds, which on a nine-target run would tie half the field and settle the places on
  the `updated_at` tie-break instead of on the run. Tenths under a minute, falling back
  to the coarse form past it.
- **The Czech label is PAMĚŤ RUKY, not SVALOVÁ PAMĚŤ.** `GameOverTitle` pins 56px letters
  and wraps mid-word past six; SVALOVÁ is seven, and the wrap is documented in that file
  as the ugly last resort. Two short words keep every letter full size.
- **Task 15 was pulled forward**, before task 6: the machine test needs a registered
  drilled mode to drive.
- **`admin-session.tsx` needed no change.** The measure is a fact about the challenge, so
  it is resolved in `lib/admin/sessions.ts` where a booking is written rather than asked
  for on the form. The planner grew no field.

### Decisions taken at a fork

- **The drill is two seeds, not one.** `drillValues` hashes the session id; `drillPlaces`
  hashes `<id>:places`. So a change to the dial's range moves the values without moving
  every card on the board, and the two halves can be reasoned about separately.
- **Places are recomputed on every layout**, not once at placement. The first target of a
  run can arrive before the board is measured, and a place worked out against a canvas of
  nought would be the one place that card kept for the whole run.
- **A drilled board is re-placed rather than clamped** when the canvas changes. Clamping
  slides two cards toward the same edge and lets them touch, which the scatter exists to
  prevent.
- **`submitScore` decides whether a run's time is kept**, rather than each call site
  asking `measureOf` first. Two call sites each asking is two places for a run to post a
  time its standings cannot use. This also brought `GameScreen` back under the cognitive
  complexity limit, which the first shape of it had crossed.
- **The fixed figure columns are a timed board's alone.** A score board's figure still
  sits at the end of the row with no width of its own. Giving every board in the app a
  fixed score column is a sweep across eleven screens for the sake of one — the
  `design-guide` skill says whose decision that is, and it is not the build's.

### Left deliberately undone

- **The SQL tests have not been run.** `supabase/tests/session_scores.sql` gained the
  measure assertions but `pnpm db:test` needs a local database this session did not have.
  Criterion 10's server half and criterion 1 are unverified; `verify` owns both.
- **Nothing has been driven in the app.** Criteria 4, 5, 7, 8 and 9 are all player-visible
  and none has been seen on a screen.

### Self-check against the acceptance criteria

| #   | Believed        | Note                                                                                                           |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | yes, unverified | `measureArg` resolves it in `planSession`/`editSession`; no DB to confirm against.                             |
| 2   | **yes**         | `lib/drill.test.ts` asserts the nine with `toEqual`, not a snapshot.                                           |
| 3   | **yes**         | Covered by the same file, including the scatter's non-overlap and both size bounds.                            |
| 4   | likely          | `cap: 500` and `maxTargets: 9` resolve correctly and the spawner indexes by dealt count. Never watched arrive. |
| 5   | likely          | `countsDown: false` and infinite lives; `clocked` now reads the rules. Never seen.                             |
| 6   | **yes**         | `machines/game.test.ts` drives all four cases, including the clock stopping.                                   |
| 7   | likely          | Deterministic by construction and tested pure; never seen twice on a device.                                   |
| 8   | likely          | `chainFrom` advances per strike and resets on `runSeq`. Never seen drawn.                                      |
| 9   | likely          | The column is wired end to end; the ordering is the migration's, unrun.                                        |
| 10  | half            | Client half tested in `lib/local-scores.test.ts`. Server half written, unrun.                                  |
| 11  | **yes**         | `modes/challenges/challenges.test.ts`.                                                                         |
| 12  | **yes**         | `pnpm check` green, 1928 tests, `i18n:verify` passes.                                                          |

Nothing here is claimed as verified. Five criteria have never been on a screen and two
depend on a migration that has not been applied.

## Amendments — 2026-10-19, after the first run was seen on a device

Four changes, from a screenshot of the board. Criteria 3, 7 and 12 were amended and
13 added; the spec carries both.

- [x] 18. **The overlap bug.** `clears` compared the distance between two cards'
      _top-left corners_ against one card's width — which two squares satisfy while
      overlapping by a quarter of their area, and which is exactly what drew 64 across 65. Replaced with an axis-aligned overlap test. **The test asserted the same wrong
      invariant and so passed**; it now checks real rectangle overlap, across five
      canvases rather than one.
- [x] 19. **`drillSize` was answering with an impossible size.** It derived the size from
      the canvas _area_, which nine squares can satisfy while being unarrangeable — three
      cards cannot fit a box narrower than three of them. It now measures against the
      grid they would have to fall into, with slack for the jitter.
- [x] 20. **Per-card sizes and colours.** `drillPlaces` returns a `DrillPlace[]` — index,
      size and place — and each card is drawn on its own pale tint from
      `challengeTints(hueOf(challenge's bright stop), count)`. `hueOf` is new and exported
      from the palette; `palette.test.ts` had a private copy of it, now deleted so the
      test measures the shipped arithmetic. `ShotAim`/`Shot` gained a `radius`, since a
      beam inset by half of _some other_ card's width lands wrong.
- [x] 21. **The run stopwatch.** `components/game/run-stopwatch.tsx`, in the slot a scored
      run keeps its average accuracy in — which was empty on a challenge, being gated on
      `SCORED_MODES`. Its own component because it redraws 20× a second and the game
      screen must not; both its props are stable for the whole of a run.
      It is drawn in the seven-segment face at `READOUT.best` — the same role, face and
      ink as the score cluster at the other end of its row, which on a race is the
      figure it has replaced.

**One new type role, and it needs agreeing** — `TYPE.figureMd`, 16px mono, no tracking.
Nothing on the scale fitted: the slot it stands in is drawn at 16px by `ScoreDigit`,
which is a drawing rather than a role and so was never on the scale, and the nearest
roles are `figure` at 11px and `cardTitle` at 17px with 2px of tracking a number must not
have. The `design-guide` rule is that a new role is agreed first; this one was added
during the build and is flagged here rather than slipped in.

## Amendments — 2026-10-19, second pass

- [x] 22. **Renamed MUSCLE MEMORY → HABIT** (`challenge/habit`), Czech **NÁVYK**. One
      word of five letters in both languages, where SVALOVÁ was seven and wrapped
      mid-word in the 56px wordmark. `DRILL` was the shortest candidate and was
      rejected: **drill** is now the domain word for the mechanism, and one challenge
      wearing it would make every future drilled challenge ambiguous. It also took its
      own three-letter **code**, `HBT` / `NVK` — it had been inheriting Accuracy's
      `ACC`, which on a profile row filed it under the board it does not keep.
- [x] 23. **A taken card stays on the board.** It was leaving, which on a fixed nine
      takes a ninth of the picture away on every hit — by the last target there is
      nothing left to have learnt. `spent` on `TargetCard` fades it back to a third
      instead of out and never reports itself gone; `settles` on `PieCountdown` swells
      the numeral and brings it back rather than holding it at 1.7×, and leaves the disc
      alone, because on a drill the disc is the thing being remembered. Nothing can be
      hit twice: the machine dropped the target the moment it was taken, so what stays is
      only the drawing.

### Known gap

A drilled run **put away and reopened mid-run loses its taken marks**. The spent cards
live in display state, and a restore rebuilds the board from the machine's targets —
which no longer hold the taken ones. The run still ends correctly and the standings are
unaffected; what is lost is the picture of how far through it the player was. Derivable
(`nextTargetId` says how many were dealt, and whatever is not standing was taken) and
deliberately not built.

- [x] 24. **A drilled run no longer respawns on a cleared board.** The spawner deals a
      target the instant the board empties — right for every other mode, where an empty
      board is dead time — but a drill holds one card for most of its opening seconds,
      so the player clears it constantly and the next target arrived on the hit rather
      than on the metronome. The nine now arrive at 0, 500, 1000 … 4000ms and at no
      other time. Not unit-tested: the guard is a React effect in a hook, and the
      repo's rule is that hooks get tests only where the behaviour is non-trivial.
- [x] 25. **A drilled mode is now always drilled** — the actual cause, and a design hole
      rather than a slip. `drillFor` returned null without a session, so a drilled mode
      reached any way _but_ the challenge dialog fell all the way back to rolling:
      random targets, a respawn the instant the board cleared, and a card replaced the
      moment it was hit. Tasks 23 and 24 each fixed a symptom of this and neither
      touched it, because both only take effect once `drill !== null`. The mode's own id
      is the fallback seed now — a session changes _which_ nine, not _whether_ there are
      nine — and the spawner takes the resolved `drill` rather than a seed, so it and
      the board's placement cannot disagree about whether a run is drilled. Pinned in
      `lib/drill.test.ts`.

- [x] 26. **A drill is indexed by a per-run counter, not by the target id.** The
      regression that emptied the board, and the root of all three reports.
      `nextTargetId` climbs for the life of the machine and is reset by nothing — the
      display list keys a card's animations on it, and a restart leaves the last run's
      cards still going, so an id dealt twice reads as the departing card rather than
      the arriving one. Indexing a drill by it meant the second run started at nine,
      past the end of its own list, and `drillValues(...)[9]` is `undefined`: no target
      dealt, ever again. The first run looked fine, which is why it survived three
      rounds of looking. `Context.dealt` counts arrivals **this run** and `Target.seq`
      carries each card's place in it, so the spawner choosing a value and the board
      drawing it read the same number. Both ride through `lib/saved-run.ts`, falling
      back to the id for a run stored before they existed — those builds had no drilled
      mode, so the two were the same number anyway, and the storage key does not move.
      Pinned in `machines/game.test.ts`.

- [x] 27. **A timed run's two screens lead with the clock.** The pause and the game over
      put the run clock in the readout and the score under it, where every other mode
      keeps the score in the readout and nothing under. One helper, `runHeadline` in
      `components/overlays/run-headline.tsx`, answers for both screens — they must not
      disagree, or a player who pauses on their clock and finishes on their score is
      looking at two different runs. `RunScore.value` widened to `number | string` and
      `RunScore.under` is the new slot; the readout's own face, size and glow are
      untouched. `formatRunClock` draws the clock with a **colon** rather than the
      stopwatch's prime marks, because DSEG7 has digits, a point and a colon and nothing
      else — and a colon is already this file's mark for a figure that is a clock rather
      than a measured length. TIME drops out of a timed run's stat row: it is the
      headline now, and printing it there again would be the figure the run is judged by
      said twice, less precisely the second time. The second figure is the same
      seven-segment face as the first, at `READOUT.best`, in the dim ink — both figures
      on the screen are readouts and should look it, and what says which one the screen
      is about is the size and the ink rather than the lettering. Ten points of air
      between them: two readouts touching read as one number broken over two lines.

- [x] 28. **Both ends of a timed run are one figure in one face.** The in-game stopwatch
      moved to the seven-segment face at `READOUT.best`, matching the score cluster at
      the other end of its row — on a race the clock is what the run is worth, so it
      should look like the figure it replaced rather than like a label. `formatRunClock`
      now serves the stopwatch and the run-screen readout alike, so a player watching
      `12.34` climb finishes on `12.34` rather than on a differently-shaped version of
      it. Two things became dead and were removed rather than left: `formatStopwatch`
      and its prime marks, which no caller is left for, and **`TYPE.figureMd`** — the
      one new type role this build added and the one thing in it still waiting to be
      agreed. It is gone, so there is nothing to agree.
