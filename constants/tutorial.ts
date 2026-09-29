import { msg } from '@lingui/core/macro'

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
// What arrives next is the teaching itself — tooltips and dialogs over this board — and
// that is why it is stripped: there is nothing here yet to talk over.

// What the run is called on screen, in place of the mode's own name.
//
// A player being taught is not told which practice mode the teaching is built out of:
// TRAINEE names a choice on the intro, and this run is not that choice — it arrived on
// its own, and it does not behave like the mode on that pill either. `runLabel` in
// machines/modes.ts is what picks between the two, so no screen has to remember.
export const TUTORIAL_LABEL = msg`TUTORIAL`

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
