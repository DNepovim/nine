import { msg } from '@lingui/core/macro'

import { ACCURACY } from '@/modes/definitions/accuracy'
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

// The four-keys dial turned inside out: sixteen keys in four rows of four, at twice the
// pace of the game at rest.
//
// Its one thing is the dial. Four rows of four, weighted row order × column order like
// every dial in the app — 1 2 3 4 / 2 4 6 8 / 3 6 9 12 / 4 8 12 16 — so the rule is the
// one the guide already prints and nothing new has to be learned to read it. The keys
// come to 100, which puts targets anywhere in 0 … 900: the first dial in the app whose
// range is bigger than a glance.
//
// The clock is the twist and nothing else is. A target gets exactly half the ring
// Accuracy gives one, which is what "double time" means here — the game at rest, at
// twice the pace.
const FOUR_BY_FOUR: ChallengeSpec = {
  slug: 'four-by-four',
  label: msg`FOUR BY FOUR`,
  description: msg`Sixteen keys, double time`,
  // Nothing named here, so the hue is whatever this entry's place in the catalog works
  // out to — see `challengeHue`. Index 1 lands around 301°, a violet-magenta well clear
  // of four-keys' turquoise and of every hue the app has spoken for.
  //
  // Nothing is drawn when a hit lands, either. A shot is the streak made visible and the
  // streak below is about the whole dial, so the honest shot would be a beam per row —
  // which is a new `ShotKind` and a component to draw it, more than a challenge should
  // carry. `quartet` was the alternative and is a beam per *key*: sixteen of them at
  // once, on keys 59pt wide.
  shot: null,
  // Every line about the dial and the rows, as four-keys' are about its four keys. No
  // tier here can be about a board, because there is no board — only the session's own
  // standings, which is what `board` and `medal` mean for a challenge.
  claims: {
    board: [
      ['FOUR', 'ROWS'],
      ['WIDE', 'HAND'],
      ['ALL', 'ROWS'],
    ],
    medal: [
      ['NEAR', 'FULL'],
      ['WIDE', 'MARK'],
    ],
    strong: [
      ['WIDE', 'WORK'],
      ['GOOD', 'SPAN'],
    ],
    cold: [
      ['COLD', 'ROWS'],
      ['WIDE', 'DIAL'],
    ],
  },
  // Accuracy rather than Speed: the clock below is halved once, flatly, and a mode that
  // also tightens its ring as the run goes would be two things moving at once on a dial
  // the player is still reading. The ring is the same from the first target to the last;
  // what ends a run here is the dial.
  base: ACCURACY,
  from: Date.UTC(2026, 9, 1),
  until: Date.UTC(2026, 9, 1) + DAY,
  rules: {
    // Sixteen keys, and the weights left to the dial's own rule — `defineDial` fills in
    // row order × column order, which is what the nine every mode is played on uses.
    //
    // Reachable throughout: the first key is worth 1, so every number in 0 … 900 can be
    // dialled and the spawner — which never asks — cannot deal an impossible target. See
    // the catalog's own test, which holds this for every challenge rather than for one.
    dial: defineDial({ id: 'four-by-four', rows: 4, cols: 4 }),
    // Hard, as four-keys is: the rung that counts for itself, pinned because the choice
    // is being taken away rather than made by the player, and because one session board
    // cannot hold three clocks at once.
    fixedDifficulty: 'hard',
    // Half of Accuracy's 22 000, which is what double time is measured against: the game
    // at rest. 11 000 × Hard's 0.75 = 8250 ms a target, and the ring stays there all run
    // — Accuracy ramps its *arrivals* rather than its clock, so what tightens is the gap
    // between targets: a third of the ring to begin with, 2750 ms, and closing from
    // there. That is also what ends a run here, since the ring never closes in on its
    // own. The dial is hard from the first target; the board is what gets hard later.
    clock: { base: 11000 },
    // The streak this one is about, and a rule written for it: a key moved in **every
    // row** of the dial. `whole` has no meaning on sixteen keys — a route through all of
    // them is not a route — and this is its wide-dial counterpart, four keys rather than
    // sixteen, costing a median of one press over par. See `STREAK_TRIGGERED.spread`,
    // where what it costs and what it cannot do are both written down.
    scoring: { streak: 'spread' },
    // No `base` and no `weights`: a hit is worth the ordinary hundred and is blended like
    // an Accuracy hit, which is every challenge's default. The run is no shorter than an Accuracy
    // run — arrivals are twice as frequent and the routes are twice as long — so there is
    // nothing here for a bigger figure to make up for.
    //
    // No `capabilities` either, so the dial prints no key weights. The rule behind them
    // is the one the guide prints, and a dial that explained itself would be the one mode
    // on the app that does.
  },
}

// HABIT: the same nine, every run — and the clock is the contest.
//
// Its one thing is the **drill**: a session of this challenge deals a fixed nine,
// derived from the session's own id, so every player meets the same targets in the same
// order in the same places, and meets them again on the next run. Nothing else about it
// is strange — the dial is the nine every mode is played on, a hit is scored on the
// route the way Accuracy scores one — because the thing being learnt has to be the board
// rather than the rules.
//
// Everything else follows from the goal, which is to be *fast at a thing you know*:
//
//   - **No ring, and nothing expires.** `countsDown: false` is the tutorial's own field
//     and does two jobs at once — no countdown is armed, and `clockLeft` scores every
//     hit as though no time had passed. There is one clock in this run and it is the
//     stopwatch the standings are ordered by; a second one on each target would be the
//     mode asking for two things.
//   - **Which is why the blend is all accuracy.** With the ring gone the speed factor is
//     a constant 1, so the Accuracy blend every challenge defaults to would make
//     fifteen points of every hit free. `{ acc: 1, spd: 0 }` is what "scored on the route"
//     actually means once the clock is off the target.
//   - **No lives.** Nothing can take one, so the hearts come off — the top bar draws
//     `lives.count` of them and draws none at infinity. The run ends when the ninth
//     target falls, which is `spawn.drill` doing it rather than a life.
//   - **All nine on the board.** `maxTargets: 9`, because `ADD_TARGET` refuses a deal
//     that would overflow the board and a drilled run must never lose one. They arrive
//     half a second apart — `cap: 500`, which is below the share of any clock here.
const HABIT: ChallengeSpec = {
  slug: 'habit',
  label: msg`HABIT`,
  // Its own, rather than Accuracy's `ACC` inherited from the base mode. A challenge
  // takes its base's code unless the variation is the point — and here it is: a row on
  // a profile reading ACC would file this under the board it is not.
  code: msg`HBT`,
  description: msg`The same nine, every run. Be quick.`,
  // The streak the challenge is about, and the one rule that rewards knowing the board:
  // the fewest moves is also the fewest presses, so a player who has learnt a route is
  // faster *and* on the multiplier, where a player mashing is neither.
  //
  // Drawn as a `chain` — the beam runs from the target taken before this one to the one
  // just taken, so a strike draws the route through the board in the order it was
  // walked. The shot is the streak made visible, and on a board that never changes the
  // thing worth seeing is the order.
  shot: 'chain',
  // Every line about knowing the board rather than about a score, because the contest
  // here is the clock and the thing being claimed is recall.
  claims: {
    board: [
      ['KNEW', 'IT'],
      ['PURE', 'DRILL'],
      ['EVERY', 'ONE'],
    ],
    medal: [
      ['HALF', 'KNOWN'],
      ['CLOSE', 'DRILL'],
    ],
    strong: [
      ['GOOD', 'HANDS'],
      ['SURE', 'DRILL'],
    ],
    cold: [
      ['COLD', 'HANDS'],
      ['NOT', 'KNOWN'],
    ],
  },
  base: ACCURACY,
  from: Date.UTC(2026, 10, 1),
  until: Date.UTC(2026, 10, 1) + DAY,
  rules: {
    fixedDifficulty: 'hard',
    clock: { countsDown: false },
    spawn: { drill: 9, maxTargets: 9, cap: 500 },
    scoring: { streak: 'optimal', measure: 'time', weights: { acc: 1, spd: 0 } },
    lives: { count: Number.POSITIVE_INFINITY, expiryCostsLife: false },
  },
}

// Mapped rather than listed, and that is what gives each challenge its colour: `.map`
// hands `defineChallenge` the spec's own index, which is what the pair is derived from.
// The list is append-only — see the note at the top of this file — so an index is a
// permanent fact about a challenge and its colour never moves.
export const CHALLENGES: readonly ModeDefinition[] = [FOUR_KEYS, FOUR_BY_FOUR, HABIT].map(
  (spec, index) => defineChallenge(spec, index),
)
