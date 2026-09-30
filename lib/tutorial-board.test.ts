import { describe, expect, it } from 'vitest'

import { TUTORIAL_OPENING_GRID, TUTORIAL_TARGETS } from '@/constants/tutorial'
import { tutorialBoardEntry } from '@/lib/tutorial-board'
import { computeSum } from '@/machines/game'

describe('the board each tutorial step is entered on', () => {
  it('opens on the lesson’s own board', () => {
    expect(tutorialBoardEntry(0)).toEqual(TUTORIAL_OPENING_GRID)
  })

  // The whole invariant, and the reason the grids can be derived at all: hitting a
  // target leaves its value dialled, so the board every step after the first is
  // entered on weighs exactly the target of the step before it.
  it('enters every later step on a board weighing the target just cleared', () => {
    TUTORIAL_TARGETS.forEach((target, index) => {
      expect(computeSum(tutorialBoardEntry(index + 1))).toBe(target)
    })
  })

  // Pinned rather than merely checked against the invariant above: many grids weigh
  // 204, and the lesson's words are true of this one. A change to the opening grid or
  // to the route planner that moves these fails here rather than in front of a player.
  it('walks the script’s own route', () => {
    expect(tutorialBoardEntry(1)).toEqual([
      [6, 2, 8],
      [2, 7, 2],
      [5, 5, 9],
    ])
    expect(tutorialBoardEntry(2)).toEqual([
      [7, 2, 8],
      [2, 7, 2],
      [5, 6, 9],
    ])
    expect(tutorialBoardEntry(3)).toEqual([
      [7, 2, 8],
      [2, 7, 2],
      [5, 6, 8],
    ])
    expect(tutorialBoardEntry(4)).toEqual([
      [7, 2, 0],
      [2, 0, 0],
      [0, 0, 1],
    ])
  })

  // Past the script there is no scripted board to go back to, and the stepper never
  // asks — but a helper that threw here would turn a stepper bug into a crash.
  it('holds at the last scripted board past the end of the script', () => {
    expect(tutorialBoardEntry(TUTORIAL_TARGETS.length + 3)).toEqual(
      tutorialBoardEntry(TUTORIAL_TARGETS.length),
    )
  })

  it('treats a negative board as the opening', () => {
    expect(tutorialBoardEntry(-1)).toEqual(TUTORIAL_OPENING_GRID)
  })
})
