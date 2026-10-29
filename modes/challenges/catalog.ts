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
  // Every key alight at once, in the strike colours every shot wears — the shot its
  // streak is made of, since a streak hit is one that moved all of them. See `ShotKind`.
  shot: 'flame',
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
  // carry. `flame` is the alternative and sets every *key* alight, which says "the whole
  // dial" where this streak says "every row".
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
    // **No `scoring` at all**, which is the whole of what this one says about streaks:
    // every challenge's default is Accuracy's own `optimal` — the cheapest route to the
    // target, the rule every Accuracy run is already played under.
    //
    // It used to ask for `spread`, a key moved in every row, written as `whole`'s
    // wide-dial counterpart. The trouble is that it pulls *against* the score: the cheap
    // answer is often two keys, so taking the streak costs a median of one press over
    // par, and on a sixteen-key dial the player is working out the dial and arguing with
    // the streak at the same time. `optimal` asks the one question the dial already
    // poses. `STREAK_TRIGGERED.spread` stays where it is — a rule nothing claims today
    // is still the rule a later challenge would claim.
    //
    // A hit is worth the ordinary hundred and blended like an Accuracy hit, which is
    // every challenge's default and what the absence of `weights` here means. The run is no
    // shorter than an Accuracy run — arrivals are twice as frequent and the routes twice
    // as long — so there is nothing for a bigger figure to make up for.
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

// GLIMPSE: every number is shown once, and then it is yours to remember.
//
// Its one thing is the **glimpse** — `spawn.glimpse`, a target's number on its card for
// half a second after it arrives and then gone. Everything else is Accuracy on Hard as a
// player already knows it: the nine dial, the 16.5 s ring, arrivals closing in, three on
// the board at once, three hearts. The memory is the strange part, so nothing else is.
//
// What the player keeps is the disc's band tint — a sliver of it under a fresh ring, more
// as the ring drains — so a hidden 247 can still be read back as two hundred and something
// by the time the player needs reminding. The number comes back as the card leaves — hit,
// lost, or swept off at the end — so a player always learns what a target was, and a heart
// lost to one they forgot says so.
//
// Nothing here about scoring or lives, because a challenge's defaults are already right
// for it: the Accuracy blend and its `optimal` streak — an exact route on a number you can
// no longer see is the thing worth multiplying — and no life for a wasteful hit, which is
// a punishment for misremembering on top of the points it already cost.
const GLIMPSE: ChallengeSpec = {
  slug: 'glimpse',
  // There is a **soft hyphen** (U+00AD) between the M and the P, invisible in an editor
  // and on every screen that draws the name on one line. The challenge dialog draws a name
  // a word per row at a pinned size, and seven letters is wider than its card — so the
  // name says where it breaks: GLIM over PSE. See lib/label-rows.ts.
  label: msg`GLIM­PSE`,
  description: msg`One look, then from memory.`,
  // No `shot`: Accuracy's sniper, inherited. A single held beam is a chain of exact
  // routes made visible, which is what the streak here is made of.
  //
  // Every line about seeing and holding on to what was seen, as four-keys' are about
  // its keys. No board tier can be about a board, because there is none.
  claims: {
    board: [
      ['SAW', 'IT'],
      ['KEPT', 'SIGHT'],
      ['SHARP', 'EYE'],
    ],
    medal: [
      ['NEAR', 'SIGHT'],
      ['HALF', 'SEEN'],
    ],
    strong: [
      ['GOOD', 'EYE'],
      ['HELD', 'IT'],
    ],
    cold: [
      ['GONE', 'BLANK'],
      ['LOST', 'SIGHT'],
    ],
  },
  base: ACCURACY,
  from: Date.UTC(2026, 9, 24),
  until: Date.UTC(2026, 9, 24) + DAY,
  rules: {
    // Hard, as every challenge so far: the rung that counts for itself, and one session
    // board cannot hold three clocks at once.
    fixedDifficulty: 'hard',
    // Half a second, unscaled by the rung — the figure here is the figure on screen.
    spawn: { glimpse: 500 },
  },
}

// NO SLIP: the exact route, every time, or the run is over.
//
// Its one thing is the **bar**: a hit has to be on the cheapest route, and the first hit
// that is not ends the run there, however many hearts are left. Everything else is Accuracy as a
// player already knows it — the nine dial, the ring, the arrivals closing in — on Easy,
// the rung with the longest clock, because the clock is not what this one is about.
//
// Everything else follows from that:
//
//   - **Three hearts, for the clock alone.** A target left to run out costs one, as on
//     every mode that spends them, so a run cannot wait out the hard targets for free. A
//     slip takes all of them (`wastefulTakesAll`): `bar: 1` asks for the exact route, the
//     one place `accuracyFactor` returns 1, and overrules Easy, whose rung asks for
//     nothing.
//   - **Ordered by hits.** A run here is as good as it was long, so the session board
//     counts every target the run took — the slip among them, since it still took its
//     target, and every run but one cut short by the window ends on exactly one — and
//     breaks a tie on the score. `measure: 'hits'`, drawn the way HABIT draws its time.
//   - **No streak.** Every hit that is not a slip is already an exact one, so a rule
//     about exact hits would build on every hit there is and say nothing; and a slip
//     already ends the run, so a broken chain on top would be two punishments for one.
//     No shot either, since a shot is the streak made visible.
const NO_SLIP: ChallengeSpec = {
  slug: 'no-slip',
  label: msg`NO SLIP`,
  // Its own, as HABIT's is: a profile row reading ACC would file it under a board it is
  // not.
  code: msg`NSL`,
  description: msg`One slip and it's over.`,
  shot: null,
  // Every line about slipping and the exact route. Only the tiers this one reaches: the
  // session standing through `board` and `medal`, and `cold`. `strong` is earned by a
  // run's streaks, and this run has none, so a line for it would never be read.
  claims: {
    board: [
      ['SURE', 'HAND'],
      ['NO', 'SLIP'],
      ['CLEAN', 'LINE'],
    ],
    medal: [
      ['NEAR', 'CLEAN'],
      ['ONE', 'SLIP'],
    ],
    cold: [
      ['EARLY', 'SLIP'],
      ['TOO', 'SOON'],
    ],
  },
  base: ACCURACY,
  from: Date.UTC(2026, 9, 26),
  until: Date.UTC(2026, 9, 26) + DAY,
  rules: {
    // Easy, pinned: 22 000 × Easy's 1.45 ≈ 31.9 s a target, so a slip is a choice about
    // the route and never a guess against the ring.
    fixedDifficulty: 'easy',
    scoring: { streak: 'none', measure: 'hits' },
    lives: {
      count: 3,
      wastefulCostsLife: true,
      expiryCostsLife: true,
      bar: 1,
      wastefulTakesAll: true,
    },
  },
}

// SIDEWAYS: Accuracy Hard on a dial that has fallen on its side.
//
// Its one thing is the **orientation** — the nine dial turned a quarter counter-clockwise,
// as if the phone were held landscape. A player who knows the dial by feel has the ×9
// under the thumb and up for more; here both are somewhere else. Everything else is
// Accuracy Hard as they already know it — the 16.5 s ring, three hearts, the `optimal`
// streak and its sniper shot — so the only thing to relearn is the dial.
//
// The turn is all of it at once, because a dial that turned only its digits, or only its
// swipes, would be a puzzle rather than a dial lying down:
//
//   - **The weights turn with it.** The ×9 that sat bottom-right is top-right now, the
//     ×1 bottom-left — given here in screen order, as every dial's are. The 1 is still
//     on it, so every target in 0 … 324 is still answerable.
//   - **The digits lie on their side**, and **the swipes turn with them**: left raises a
//     key, right lowers it, up fills it, down empties it, and a tap still raises it — see
//     `orientMove`.
//
// Par counts presses, not directions, so a route is scored exactly as upright.
const SIDEWAYS: ChallengeSpec = {
  slug: 'sideways',
  // A **soft hyphen** (U+00AD) between the E and the W, invisible on a line wide enough
  // for the word: eight letters is wider than the challenge dialog's row, which GLIMPSE
  // found at seven. It breaks SIDE over WAYS. See lib/label-rows.ts.
  label: msg`SIDE­WAYS`,
  // Its own, as HABIT's and NO SLIP's are: a profile row reading ACC would file it under
  // a board it is not.
  code: msg`SDW`,
  description: msg`The dial has fallen on its side.`,
  // No `shot`: Accuracy's sniper, inherited — the streak is Accuracy's own.
  //
  // Every line about lying down and turning, since that is the one thing that changed.
  claims: {
    board: [
      ['LAID', 'LOW'],
      ['SIDE', 'WON'],
      ['TURN', 'KEPT'],
    ],
    medal: [
      ['NEAR', 'LEVEL'],
      ['SIDE', 'STEP'],
    ],
    strong: [
      ['GOOD', 'TURN'],
      ['SURE', 'SIDE'],
    ],
    cold: [
      ['TIPPED', 'OVER'],
      ['ALL', 'ASKEW'],
    ],
  },
  base: ACCURACY,
  from: Date.UTC(2026, 9, 27),
  until: Date.UTC(2026, 9, 27) + DAY,
  rules: {
    // Hard, as every challenge built on Accuracy so far.
    fixedDifficulty: 'hard',
    dial: defineDial({
      id: 'sideways',
      rows: 3,
      cols: 3,
      weights: [3, 6, 9, 2, 4, 6, 1, 2, 3],
      orientation: 'sideways',
    }),
  },
}

// DRIFT: Accuracy Hard, where no number holds still.
//
// Its one thing is the **drift** — every target's number moves by one each second, up or
// down, the way the arrow on its card says, for as long as it stands. A player aims at
// where it is going, not where it was, and the number that counts is the one it shows at
// the press. Everything else is Accuracy Hard: the nine dial, the 16.5 s ring, three
// hearts, arrivals closing in.
//
// Everything that is not the dial follows from the moving number:
//
//   - **Scored on speed alone.** A route to a number that has since moved is a route to
//     the wrong number, so how few presses it took means nothing here — `{ acc: 0,
//     spd: 1 }`, which makes speed the headline. The author's call, and the honest one.
//   - **The strike is `fresh`**: a target taken before its number has moved at all, in its
//     first second. Any later hit breaks the chain — catching it early is the whole skill.
//   - **The shot is `burst`**, Speed's: the fast hit made visible.
//   - **Nothing drifts off the dial.** A rising target arrives low enough, a falling one
//     high enough, to stay on it for its whole ring — see `driftRange`.
const DRIFT: ChallengeSpec = {
  slug: 'drift',
  label: msg`DRIFT`,
  // Its own, as every challenge since HABIT's: a profile row reading ACC would file it
  // under a board it is not.
  code: msg`DRF`,
  description: msg`Every number drifts. Catch it before it moves.`,
  shot: 'burst',
  // Every line about catching a number before it gets away.
  claims: {
    board: [
      ['QUICK', 'DRAW'],
      ['CAUGHT', 'EARLY'],
      ['HELD', 'STILL'],
    ],
    medal: [
      ['NEAR', 'CATCH'],
      ['LATE', 'GRAB'],
    ],
    strong: [
      ['FIRST', 'LOOK'],
      ['SNAP', 'SHOT'],
    ],
    cold: [
      ['DRIFTED', 'OFF'],
      ['ALL', 'ADRIFT'],
    ],
  },
  base: ACCURACY,
  from: Date.UTC(2026, 9, 28),
  until: Date.UTC(2026, 9, 28) + DAY,
  rules: {
    fixedDifficulty: 'hard',
    // One step a second, unscaled by the rung — the figure here is the step on screen.
    spawn: { drift: 1000 },
    scoring: { weights: { acc: 0, spd: 1 }, streak: 'fresh' },
  },
}

// ONE KEY: Accuracy Hard on a dial of a single key, with a second to answer each target.
//
// Its one thing is the **key** — one, worth ×1, so every target is a digit from 0 to 9 and
// the sum row is the key itself. With nothing to choose between, the clock is what makes
// it a contest, and the two only work together: a single key on a 16.5 s ring is a
// formality, and a one-second ring on the nine is a guess.
//
//   - **A one-second ring, one target at a time.** `maxTargets: 1`, so every hit clears
//     the board and the next target is dealt at once — the run is a rhythm, not a board.
//   - **The route still matters.** A tap raises the key, a swipe right fills it and a
//     swipe left empties it, so an 8 is two presses (right, down) or eight taps. The
//     `optimal` streak builds on the short one, which is the one that takes thinking and
//     the clock leaves least time for.
//   - **A slow route costs nothing**, a challenge's default; a target let run out costs
//     one of three hearts, and that is how a run ends.
//
// The 1 is the whole dial, so every target in 0 … 9 is answerable.
const ONE_KEY: ChallengeSpec = {
  slug: 'one-key',
  label: msg`ONE KEY`,
  // Its own, as every challenge since HABIT's: a profile row reading ACC would file it
  // under a board it is not.
  code: msg`KEY`,
  description: msg`One key, one second.`,
  // No `shot`: Accuracy's sniper, inherited — the streak is Accuracy's own. Its 420 ms
  // beam outlives the moment the next target arrives, which the author chose knowingly.
  //
  // Every line about the one key and the one second.
  claims: {
    board: [
      ['ONE', 'KEY'],
      ['LONE', 'KEY'],
      ['SOLE', 'KEY'],
    ],
    medal: [
      ['NEAR', 'ONE'],
      ['ONE', 'SHY'],
    ],
    strong: [
      ['QUICK', 'KEY'],
      ['SURE', 'KEY'],
    ],
    cold: [
      ['TOO', 'SLOW'],
      ['KEY', 'LOST'],
    ],
  },
  base: ACCURACY,
  from: Date.UTC(2026, 9, 29),
  until: Date.UTC(2026, 9, 29) + DAY,
  rules: {
    fixedDifficulty: 'hard',
    dial: defineDial({ id: 'one-key', rows: 1, cols: 1, weights: [1] }),
    // 1333 × Hard's 0.75 rounds to exactly 1000 ms — the figure here is what the ring is.
    clock: { base: 1333 },
    spawn: { maxTargets: 1 },
  },
}

// Mapped rather than listed, and that is what gives each challenge its colour: `.map`
// hands `defineChallenge` the spec's own index, which is what the pair is derived from.
// The list is append-only — see the note at the top of this file — so an index is a
// permanent fact about a challenge and its colour never moves.
export const CHALLENGES: readonly ModeDefinition[] = [
  FOUR_KEYS,
  FOUR_BY_FOUR,
  HABIT,
  GLIMPSE,
  NO_SLIP,
  SIDEWAYS,
  DRIFT,
  ONE_KEY,
].map((spec, index) => defineChallenge(spec, index))
