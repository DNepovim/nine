import {
  scriptedTarget,
  TUTORIAL_LABEL,
  TUTORIAL_MAX_TARGETS,
  TUTORIAL_OPENING_GRID,
  TUTORIAL_OPENING_TARGET,
  TUTORIAL_TARGET_REACH,
} from '@/constants/tutorial'
import type { Submode } from '@/modes/types'

// The tutorial, as the three rules that make it one.
//
// A **submode**, not a mode: everything else about it is Trainee, down to the colour, so
// `mode` stays `trainee` and every rule that asks about the mode keeps the answer it
// already had. What changes is here, laid over Trainee's own rules by `resolveRules`.
//
// What it takes off Trainee:
//
//   · The clock. A target waits as long as it takes and leaves only when it is hit, so
//     nothing can be lost while the player is still working out what the keys do. A hit
//     is scored as though none of the ring had run, because none of it had.
//   · The cadence. One target stands on the board at a time, and the next arrives when
//     that one is hit rather than on a timer — a learner should never be behind.
//   · The options. The dial prints the one number it cannot be worked out without, the
//     weight on each key, and the pause screen offers nothing to change.
//
// The stat block and the coach go with the options: a lesson is already saying one thing
// at a time, and a debrief underneath it is a second voice. The lesson itself is
// machines/tutorial-lesson.ts; the numbers it runs on are constants/tutorial.ts.
export const TUTORIAL: Submode = {
  id: 'tutorial',
  // A player being taught is not told which practice mode the teaching is built out of:
  // TRAINEE names a choice on the intro, and this run is not that choice.
  label: TUTORIAL_LABEL,
  patch: {
    clock: { countsDown: false, playerSet: false },
    spawn: {
      maxTargets: TUTORIAL_MAX_TARGETS,
      cadence: false,
      reach: TUTORIAL_TARGET_REACH,
    },
    capabilities: { coached: false, keyHints: true },
  },
  opening: { grid: TUTORIAL_OPENING_GRID, target: TUTORIAL_OPENING_TARGET },
  script: scriptedTarget,
}
