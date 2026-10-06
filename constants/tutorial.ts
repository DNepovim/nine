import { msg } from '@lingui/core/macro'

import { type Grid } from '@/modes'

// The tutorial: the run a first launch opens on, and the three rules that make it one.
//
// Not a mode of its own. It is Trainee with everything that can wait taken off it — the
// same blue, the same infinite lives, no board and no score — so `mode` stays `trainee`
// throughout and every rule that asks about the mode keeps the answer it already had.
// What marks the run is `tutorial` on the machine's context; see machines/game.ts.
//
// What it takes off Trainee:
//
//   · The clock. A target waits as long as it takes and leaves only when it is hit, so
//     nothing can be lost while the player is still working out what the keys do.
//   · The cadence. One target stands on the board at a time, and the next arrives when
//     that one is hit rather than on a timer — a learner should never be behind.
//   · The options. The dial prints the one number it cannot be worked out without, the
//     weight on each key, and the pause screen offers nothing to change.
//
// Over that board runs the lesson: a fixed opening, two tooltips naming the two numbers,
// a route walked one lit key at a time, and then a board apiece for every gesture the
// route did not need. The script itself is machines/tutorial-lesson.ts; the numbers it
// runs on are below.

// What the run is called on screen, in place of the mode's own name.
//
// A player being taught is not told which practice mode the teaching is built out of:
// TRAINEE names a choice on the intro, and this run is not that choice — it arrived on
// its own, and it does not behave like the mode on that pill either. `runLabel` in
// machines/modes.ts is what picks between the two, so no screen has to remember.
export const TUTORIAL_LABEL = msg`TUTORIAL`

// The board every tutorial opens on, with TUTORIAL_OPENING_TARGET already standing on it.
//
// A dial of nine zeros is the right opening for a run and the wrong one for a lesson: it
// is the one board where every key looks alike and nothing on it has happened yet, so
// there is nothing to point at and no reason one key should be pressed before another.
// This one sums to 185 against a target of 204, a gap of 19 — and 19 is 9 + 6 + 4, one tap
// each on three keys of three different weights. The lesson walks them coarsest first,
// which is the order the whole game is played in, and the three sit in three different
// parts of the dial: the corner, the bottom edge, the middle.
//
// The digits are five different ones with no zero among them, which took some finding —
// a board has to average about five per key to sum this high, and the obvious ways to get
// there are a row of sevens or a lone zero surrounded by nines. Neither is a dial anybody
// would recognise as a position they could have played themselves, and a first lesson
// standing on one teaches that the game deals oddities.
//
// Fixed rather than dealt, and that is the point: the cards name the two numbers on
// screen, so the lesson has to know what they are. A test pins the route the pair
// produces, so a change to either number that spoils the lesson fails rather than ships.
export const TUTORIAL_OPENING_GRID: Grid = [6, 2, 8, 2, 6, 2, 5, 4, 8]

// The targets the lesson deals itself, in order, before the spawner starts rolling them.
//
// Every one is fixed, and each is chosen to make one gesture the obvious answer — the
// lesson teaches the dial by dealing boards that ask for each move in turn:
//
//   204  the opening, on TUTORIAL_OPENING_GRID (185). Three taps up, guided one key at a
//        time: ⑨ 8→9, ⑥ 4→5, ④ 6→7. Nothing here needs a swipe.
//   211  seven above the sum the first hit leaves, and the first the player takes alone.
//        ⑥ 5→6 then ① 6→7 — the coarse key covers the ground, the finest trims the last
//        point, which is the whole idea of the dial in two taps.
//   202  nine below. Taps only climb, so this is the first board that cannot be answered
//        without a swipe down, and the lesson says so.
//   24   far below anything reachable by stepping. Emptying keys outright — a swipe left —
//        is the only sane way down, and a dozen swipe-downs is what makes that plain.
//   216  far above. The same argument the other way: keys have to be filled to nine, and
//        a swipe right is what does it.
//   54   what the board before it leaves, less its whole bottom row. Those three keys
//        stand at nine and are worth 162 between them, which is exactly the drop — and no
//        two keys on the dial can shed that much, so the route is those three and only
//        those three. Adjacent, in a line, each asked for the same move: the first board
//        three separate gestures answer worse than one drag that never lifts.
//
// Fixed rather than rolled because a rolled target cannot be taught against: it may land
// anywhere, including exactly where the lesson was about to say nothing is. The sum after
// each hit is known exactly — it is the target just cleared — so each of these sits a
// known distance from the board the player is standing on, whatever route they took to it.
//
// From the seventh target on the run is an ordinary tutorial run: rolled, within
// TUTORIAL_TARGET_REACH of the one just hit. `machines/tutorial-lesson.ts` walks its own
// steps off this same list, and a test holds the two to the same length.
export const TUTORIAL_TARGETS = [204, 211, 202, 24, 216, 54] as const

// The first of them. Dealt by the machine at START rather than by the spawner, because a
// tutorial has to open with a target already standing on the board.
export const TUTORIAL_OPENING_TARGET = TUTORIAL_TARGETS[0]

// The target the lesson deals once this many targets have gone down, or null once the
// script has run out and the spawner takes over.
export const scriptedTarget = (hits: number): number | null =>
  TUTORIAL_TARGETS[hits] ?? null

// How long the lesson waits before its first word. Long enough that the board is drawn
// and the target has finished springing in — a tooltip pointing at something still on
// its way in points at nothing — and short enough to read as part of the arrival.
export const TUTORIAL_FIRST_WORD_MS = 300

// How long the congratulation holds — the one thing in the lesson on a clock.
//
// Nothing else is. The two pointing cards hold the dial shut while they are up, so a clock
// taking one away is a clock deciding the player has read it, and the one who had not is
// left looking at a board that has silently started expecting something. The swipe lesson
// waits for the swipe: it is the only line in the tutorial asking for a gesture nothing else
// has asked for, so the gesture itself is what says it landed.
//
// The congratulation asks for nothing and is read while the player is already playing, which
// leaves it nothing to wait for.
export const TUTORIAL_BANNER_MS = 4000

// The band the lesson talks in, above the spawn canvas — held open for the whole run so the
// canvas under it never changes size. It stands where Trainee's stat block stands, which the
// tutorial does not draw.
//
// Two lines' worth. Most of what the lesson says fits on one, and the ones naming a gesture
// do not — nor does much of anything once it has been translated.
export const TUTORIAL_BANNER_HEIGHT = 56

// How many targets may share the board. One, which is the whole of the second rule.
export const TUTORIAL_MAX_TARGETS = 1

// How far a new target may land from the one just hit, in target units.
//
// Hitting a target leaves its value dialled, so this is also how far the grid has to
// travel to reach the next one — a small journey from a number already on the dial,
// rather than a fresh route worked out from wherever the last one left off. 80 is about
// a quarter of the range, which is short enough to be reachable on the coarse keys alone
// and long enough that the fine ones still have to finish the job.
export const TUTORIAL_TARGET_REACH = 80
