# Scramble — Plan

Spec: docs/work/2026-10-29-scramble/spec.md

## Tasks

- [x] 1. `modes/dial.ts`: `scramble` on `DialSpec`, default false; `modes/dial.test.ts`
- [x] 2. `lib/scramble.ts` + `lib/scramble.test.ts`: `scrambleGrid`, seeded through `lib/rng.ts`
- [x] 3. `machines/game.ts` `applyGrid`: scramble after a hit, survivors re-referenced; machine tests (catalog entry pulled forward from task 5: the machine tests need it)
- [x] 4. `components/game/dial.tsx` + `dial-button.tsx`: every key flips on a scramble (+ the pan's grid copy resyncs after a mid-gesture scramble)
- [x] 5. `modes/challenges/catalog.ts`: `SCRAMBLE` appended, claims; `pnpm i18n:extract` + Czech
- [x] 6. `docs/domain.md` row, `CLAUDE.md` one-liner; `pnpm check`

- [x] 7. Review round: `dial-button.tsx` settles an owed flip before a scramble's arrival; `dial.tsx` ignores the rest of a gesture once a scramble lands mid-drag; prop `hits` → `hitSeq`
- [x] 8. `lib/scramble.ts`: each key avoids the digit it showed before the press as well as the dialled one; test

## Build notes

- **Lives:** the entry writes `lives: { wastefulCostsLife: true }`. A challenge's default
  turns it off, and the spec had assumed it was inherited. AC 1 caught it; the spec is
  amended.
- **Dial prop:** `Dial` takes `hits` (the run's `hitBatch.seq`) and passes
  `scrambles={dial.scramble ? hits : 0}` to each key, not a `scrambleSeq` from the game
  screen. Deciding it on the screen pushed `index.tsx` over the cognitive-complexity lint.
- **Not in the spec, needed:** the pan's grid copy (`held` in `dial.tsx`) only resynced
  when no gesture was down. A scramble mid-drag, with no later grid change, left it stale.
  Now the skipped render is kept in `owedGrid` and applied in `onFinalize` once nothing is
  in flight. Review focus 4 covers it.
- **Flip:** the key a swipe hit with gets its own flip and then the scramble's arrival, so
  it moves twice. Left that way on purpose: it reads as the dial moving.
- **Not covered by a test:** AC 5's "a par hit on a survivor builds the streak". Par is
  asserted to equal `computePar` on the scrambled grid, and the streak logic is unchanged.
  AC 8's restore half: the grid is already in the saved run, and the seed (`runId`, `hits`)
  comes back with it. AC 9 needs the device.
- Dev data: none. No table, nothing stored.
- **Round 3 (review):** the arrival stands aside while the key's own flip is in the air.
  The flip brings the scrambled digit in, and its callback still sends the owed press, so
  no `settle()` from the JS thread is needed. `interrupted` in `dial.tsx` ends a gesture a
  scramble lands in (set from `hitSeq` while a finger is down, cleared on `onBegin`).
  `scrambleGrid` takes `before` and keeps each key off both digits; the machine passes
  `context.grid`.
- **Round 2 (AC 12):** the label is `SCRAM­BLE` and the Czech `ZAMÍ­CHÁNO`, each with a soft
  hyphen per `lib/label-rows.ts`, split by syllable as GLIM­PSE / ZÁ­BLESK are.

## Review

**Round 2: clean.** Findings 1, 3, 4 and 6 are fixed as built in round 3. The arrival
skips only while the key's own flip is in the air, so `settle()` still runs and
`inFlight` drains. `interrupted` is set only with a finger down on a scrambling dial and
is cleared on `onBegin`. The two-digit fallback in `landingsFor` is still pinned by its
test.

Round 1:

`/code-review high`, scoped to this item's files. 7 findings.

- **Reopened (tasks 7–8):** (1) the arrival cancels an in-flight flip, so its press is lost
  and `inFlight` leaks; (2) the grid copy then stays stale, which follows from 1; (3) a
  mid-drag scramble leaves the rest of the drag checking moves against old digits. Decided
  by advisor (inline): the rest of that gesture is ignored, because a drag planned on a dial
  that has since moved has nothing left to mean. (4) the pressed key could land back on its
  pre-press digit, looking undone with no arrival; (6) the `hits` prop is misnamed.
- **Left deliberately:** (5) scramble × drift could give a free hit a step later. No
  challenge combines them, and AC 4 is about the shown number. (7) detection centralised in
  `Dial`: 1 and 3 fix the defects themselves.
- **Fixed in review:** "on the board" → "standing" in `lib/scramble.ts`'s comment.
- **House pass:** clean. No mode branching (`dial.scramble` only); Czech read; How to Play
  needs nothing; the motion reuses the flip's own timings.
- **Later work items:** a scramble that keeps clear of a drifting target's whole path (via
  `driftPath`) if scramble and drift ever share a challenge; one per-dial command channel
  for flips and scrambles.

## Verification log

**Round 3 verdict: 13/14 PASS, 1 SKIPPED (14).** Suite green: 0 lint errors, types,
Knip, 2 099 tests, i18n 919/919. Prettier flags only the other item's
`challenge-analytics/plan.md`. AC 13 passes on `scramble.test.ts` (1 000 seeds, pressed key
never back on its pre-press digit) and `game.test.ts`. **AC 14 SKIPPED:** a press racing a
scramble mid-drag can't be driven here, because the local profile moved and the DEV lab is gone from :8082.
Check it on a device: a fast drag through the hitting key, then lift; every key should
answer afterwards.

**Round 2 verdict: 12/12 PASS.** Round 1 failed only 12 (SCRAMB / LE); fixed with soft hyphens.

Round 2: AC 11 re-run green (typecheck, Knip, 2 092 tests, i18n 919/919). Prettier flags only
`docs/work/2026-10-29-challenge-analytics/spec.md`, another item created mid-session and not
this work. AC 12 passes on `labelRows` from both catalogs: SCRAM / BLE and ZAMÍ / CHÁNO
(scratch test, removed). Not re-seen on screen: the local profile had moved and the lab was
gone, and the card is already shown honouring a soft hyphen for GLIM­PSE / SIDE­WAYS.

Round 1:

| #   | Criterion                                   | Result         | Evidence                                                                                                                                                             |
| --- | ------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `runRules` resolves as specified            | PASS           | `challenges.test.ts` › scramble                                                                                                                                      |
| 2   | Every other mode has `scramble: false`      | PASS           | `challenges.test.ts` (only one), `dial.test.ts`; existing suites untouched and green                                                                                 |
| 3   | A hit moves every key                       | PASS           | `game.test.ts` › SCRAMBLE; in app `[0,0,0/0,2,0/0,0,8]` → `[1,3,8/5,9,7/4,1,7]`                                                                                      |
| 4   | Sum lands on no standing target             | PASS           | `scramble.test.ts` (1 000 seeds × 3 dials); in app sum 200 with 224 and 19 standing                                                                                  |
| 5   | Survivors re-referenced; par hit streaks    | PASS           | `game.test.ts`; scratch test, 50 runs, par hit after a scramble → streak 2, hearts 3                                                                                 |
| 6   | The hit is judged on the dialled route      | PASS           | `game.test.ts`; in app the par hit on 80 kept its hearts and drew the strike                                                                                         |
| 7   | A miss leaves the dial as pressed           | PASS           | `game.test.ts`; in app the presses before the hit stayed as pressed                                                                                                  |
| 8   | Deterministic; restore keeps grid and seed  | PASS           | `game.test.ts`; scratch test through `toSavedRun` → JSON → `restoreRun`: same grid, same next scramble                                                               |
| 9   | Keys flip; later presses use the new digits | PASS           | web, lab run: keys caught mid-flip; tap ×1 2, swipe left ×3 0, sum 177 as expected; no console error. A press-during-scramble race was not driven                    |
| 10  | Appended last; hues kept                    | PASS           | `challenges.test.ts` order test, `palette.test.ts`                                                                                                                   |
| 11  | `pnpm check` green, Czech                   | PASS           | 2 092 tests; 0 lint errors (167 pre-existing typography warnings); i18n verify 919/919                                                                               |
| 12  | _New:_ the name breaks where it should      | FAIL→PASS (r2) | challenge card draws **SCRAMB / LE**: a one-word label wider than a row needs a soft hyphen (`lib/label-rows.ts`), as SIDE­WAYS / GLIM­PSE have; Czech ZAMÍCHÁNO too |

Also seen, no action: the cold claim **NO HOLD** drawn on game over with the challenge and SCRAMBLE pills. The dev server on :8081 served a stale bundle (none of this work in it); verified on :8082 instead.
