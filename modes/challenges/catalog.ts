import { msg } from '@lingui/core/macro'

import { SPEED } from '@/modes/definitions/speed'
import { defineDial } from '@/modes/dial'
import type { ModeDefinition } from '@/modes/types'

import { defineChallenge } from './define'

// Every challenge the app has ever carried, each with the window it ran in.
//
// A list rather than only the live ones, and nothing is deleted from it. A challenge's
// window closes but its id does not stop existing: a stored run, a stat row and a
// player's history all still name it, and a mode nothing is registered under reads to
// all three as corrupt rather than as over. So an expired challenge stays here, out of
// every list the player sees (see `isOpenMode`) and still answerable by name.
//
// Hand-written for now. The windows are absolute timestamps, so the natural next step is
// for this list to be fetched rather than compiled in — the rest of the package does not
// care which, since a challenge reaches the registry as a `ModeDefinition` either way.
// What that will need first is on the server, not here: `scores.mode` is a text column
// with a `check (mode in ('accuracy', 'speed'))` on it, so no challenge can keep a
// published board until that check is widened.

const HOUR = 3600_000
const DAY = 24 * HOUR

// The worked example, and the only one: Speed on a dial of four keys worth 1, 2, 2 and 4,
// where the two middle keys are interchangeable and the whole dial reaches 81.
//
// The weights are deliberately coprime-ish rather than a single multiple: a dial whose
// every key is a multiple of three can only ever land on a multiple of three, and targets
// are drawn from the whole of `0 … maxSum` with no reachability filter on them — see
// `fullRange` in lib/target-value.ts. The 1 key is what makes every number in the range
// answerable, so a target can never spawn that the dial cannot reach.
//
// Its window has closed, so it is in no list the player sees. It is kept because it is
// the thing to copy — every group a challenge may bend is bent in it exactly once — and
// because the tests walk it.
const FOUR_KEYS = defineChallenge({
  slug: 'four-keys',
  label: msg`FOUR KEYS`,
  description: msg`Four keys, two of them twins.`,
  base: SPEED,
  from: Date.UTC(2026, 8, 1),
  until: Date.UTC(2026, 8, 1) + DAY,
  rules: {
    // Targets follow the dial on their own: the range is `0 … maxSum`, and `maxSum` is
    // derived from these weights — 9 × (1 + 2 + 2 + 4) = 81.
    dial: defineDial({ id: 'four-keys', rows: 2, cols: 2, weights: [1, 2, 2, 4] }),
    // One rung, so the intro shows no difficulty row at all — `usesDifficulty` is just
    // `fixedDifficulty === null`, and the row, the pause badge and the career stage all
    // read it. Hard is the rung that counts for itself: `scoreWeight` 1, so a point
    // scored here is worth a point, which is the neutral thing to pin when the choice is
    // being taken away from the player rather than made by them.
    fixedDifficulty: 'hard',
    // Halved from the 18 000 it opened at. Note this is the figure *before* the rung's
    // own `timeoutScale`, which is where the clock a target actually gets comes from:
    // 9000 × Hard's 0.75 = 6750 ms.
    clock: { base: 9000 },
    // A quarter of the clock between arrivals rather than the third every other mode
    // waits — so the board fills faster than the dial can empty it, which is what two
    // targets at once is for. Measured against the clock a target gets *now*, so it
    // tightens with the ramp rather than staying at the figure the run opened on:
    // 6750 / 4 ≈ 1688 ms at the start, and less the deeper the run goes.
    spawn: { maxTargets: 2, share: 1 / 4 },
    scoring: { streak: 'clear', base: 150 },
    lives: { count: 2 },
  },
})

export const CHALLENGES: readonly ModeDefinition[] = [FOUR_KEYS]
