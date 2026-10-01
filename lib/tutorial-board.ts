import { TUTORIAL_OPENING_GRID, TUTORIAL_TARGETS } from '@/constants/tutorial'
import { computeKeyPlan } from '@/machines/scoring'
import { NINE_DIAL, type Grid } from '@/modes'

// The board every later step of the lesson is entered on. The first one is
// TUTORIAL_OPENING_GRID, beside the rest of the tutorial's fixed numbers.

// The grid one optimal route later. Every key the plan names is set outright to the value
// it was owed, which is what the route the lesson walks arrives at — the plan is the same
// one `useTutorialLesson` lights a key at a time.
const walk = (grid: Grid, target: number): Grid => {
  const walked = [...grid]
  for (const step of computeKeyPlan(NINE_DIAL, grid, target)) {
    walked[step.index] = step.to
  }
  return walked
}

// The board the lesson's nth step stands on, counted from nought — so step `board` is the
// one standing when the run's hit count is `board`, and `TUTORIAL_TARGETS[board]` is the
// target on it.
//
// Derived rather than recorded. The alternative was a ledger snapshotting the grid each
// board was actually entered on, which is faithful to the player's own route but is new
// state that has to ride along in the saved run — and a restored run could then be put
// back only as far as its ledger happened to reach. Deriving costs the player's particular
// route and buys a rewind that is pure, identical on every device, and unaffected by a
// restore. It also puts them on exactly the board each lesson was written against, which
// is the board that lesson's words are true of.
//
// Walked from the opening every time rather than cached: five boards of nine keys is
// nothing, and a rewind happens when a thumb moves.
export function tutorialBoardEntry(board: number): Grid {
  let grid = TUTORIAL_OPENING_GRID
  // Clamped at both ends. Below nought there is no board but the opening; past the script
  // there is no scripted board at all, and holding at the last one keeps a stepper bug
  // from becoming a crash.
  const steps = Math.min(Math.max(board, 0), TUTORIAL_TARGETS.length)
  for (let i = 0; i < steps; i++) grid = walk(grid, TUTORIAL_TARGETS[i] ?? 0)
  return grid
}
