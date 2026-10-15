import { msg } from '@lingui/core/macro'

import { SPEED } from '@/modes/definitions/speed'
import { defineDial } from '@/modes/dial'
import type { ModeDefinition } from '@/modes/types'

import { defineChallenge, type ChallengeSpec } from './define'
import { TURQUOISE } from './palette'

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
const FOUR_KEYS: ChallengeSpec = {
  slug: 'four-keys',
  label: msg`FOUR KEYS`,
  description: msg`Four keys, doubled speed`,
  // Turquoise at its blue end, rather than the violet its place in the catalog works out
  // to. The arc never reaches this hue on its own — see `TURQUOISE`, which also records
  // what naming it costs: its bright stop is too pale to carry a word, so the edge and
  // the name are two shades of it.
  hue: TURQUOISE,
  // One beam from each key, in this challenge's own colour — the shot its streak is
  // made of. See `ShotKind`, and the `whole` rule above that it draws.
  shot: 'quartet',
  // What the screen says when this one ends. Only the tiers a challenge actually
  // reaches: a session standing through `board` and `medal`, and the three a run earns
  // on its own merits. The rest fall through to the app's own pools.
  //
  // Every line is about this dial rather than about a board — FOUR KEYS has no board to
  // take, and being told it took gold on one would be the screen describing a thing that
  // does not exist.
  claims: {
    board: [
      ['FOUR', 'KEYS'],
      ['KEPT', 'FOUR'],
      ['ALL', 'FOUR'],
    ],
    medal: [
      ['NEAR', 'FOUR'],
      ['HELD', 'FOUR'],
    ],
    strong: [
      ['GOOD', 'KEYS'],
      ['SURE', 'FOUR'],
    ],
    cold: [
      ['FOUR', 'HARD'],
      ['COLD', 'KEYS'],
    ],
  },
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
    // The streak this challenge is really about: a target taken with **every key moved**
    // builds it, and any hit that did not breaks it.
    //
    // It inherited `clear` from the base mode, which is the legacy board-clear rule —
    // it builds only when the board empties and `STREAK_BROKEN.clear` is `false`, so
    // nothing the player does can break it. The most forgiving of the four, on the one
    // mode meant to be read carefully.
    //
    // `whole` pulls against the score, which is the point: the cheapest route to a sum
    // rarely wants all four keys, so the multiplier and the accuracy factor are asking
    // for different things and the player picks one on every target. A rule that only
    // works on a small dial, on the only mode that has one.
    scoring: { streak: 'whole', base: 150 },
    // No `lives` here, deliberately: three, like every other mode that spends them.
    // This pinned two, which made the one mode a player meets cold — a dial they have
    // never used, a clock they have not learned — also the one that forgives least. A
    // challenge may still pin its own count; this one has no reason to.
  },
}

// Mapped rather than listed, and that is what gives each challenge its colour: `.map`
// hands `defineChallenge` the spec's own index, which is what the pair is derived from.
// The list is append-only — see the note at the top of this file — so an index is a
// permanent fact about a challenge and its colour never moves.
export const CHALLENGES: readonly ModeDefinition[] = [FOUR_KEYS].map((spec, index) =>
  defineChallenge(spec, index),
)
