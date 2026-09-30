import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { MAX_TARGET } from '@/constants/game'
import {
  scriptedTarget,
  TUTORIAL_OPENING_TARGET,
  TUTORIAL_TARGETS,
} from '@/constants/tutorial'
import { buildPressGrid, computeSum, gameMachine, type Grid } from '@/machines/game'
import { computeKeyPlan, computePar } from '@/machines/scoring'
import {
  dismissedByTap,
  FIRST_STEP,
  keyControl,
  LESSON_AFTER_HIT,
  LESSON_DIAL,
  LESSON_HOLD_MS,
  LESSON_LINE,
  LESSON_VOICE,
  lessonStep,
  type LessonStep,
} from '@/machines/tutorial-lesson'

// Every step, in the order the lesson meets them. Shared by the tables below so a new step
// cannot be added to one and forgotten in another.
const STEPS: readonly LessonStep[] = [
  'waiting',
  'target',
  'sum',
  'guided',
  'congrats',
  'free',
  'swipeDown',
  'swipeLeft',
  'swipeRight',
  'practice',
  'done',
]

// The script run start to finish by tapping through it, which is the fastest path a
// player has.
const tapThrough = (from: LessonStep, times: number): LessonStep => {
  let step = from
  for (let i = 0; i < times; i++) step = lessonStep(step, { type: 'ADVANCE' })
  return step
}

describe('the lesson script', () => {
  it('opens on the beat before its first word', () => {
    expect(FIRST_STEP).toBe('waiting')
  })

  it('reaches the guided route in three advances', () => {
    expect(tapThrough(FIRST_STEP, 1)).toBe('target')
    expect(tapThrough(FIRST_STEP, 2)).toBe('sum')
    expect(tapThrough(FIRST_STEP, 3)).toBe('guided')
  })

  it('holds on the guided route until the hit lands', () => {
    expect(tapThrough('guided', 5)).toBe('guided')
    expect(lessonStep('guided', { type: 'HIT', hits: 1 })).toBe('congrats')
  })

  it('hands the dial over after the congratulation', () => {
    expect(lessonStep('congrats', { type: 'ADVANCE' })).toBe('free')
  })

  it('opens one lesson per target the script deals, in order', () => {
    // Each hit clears one of TUTORIAL_TARGETS and is answered by the lesson for the board
    // dealt in its place.
    expect(lessonStep('guided', { type: 'HIT', hits: 1 })).toBe('congrats')
    expect(lessonStep('free', { type: 'HIT', hits: 2 })).toBe('swipeDown')
    expect(lessonStep('free', { type: 'HIT', hits: 3 })).toBe('swipeLeft')
    expect(lessonStep('free', { type: 'HIT', hits: 4 })).toBe('swipeRight')
    expect(lessonStep('free', { type: 'HIT', hits: 5 })).toBe('practice')
  })

  it('signs off after the last scripted board, then says nothing more', () => {
    expect(lessonStep('practice', { type: 'ADVANCE' })).toBe('done')
    expect(lessonStep('practice', { type: 'SWIPED', swipe: 'left' })).toBe('practice')
  })

  it('is over once the script has run out', () => {
    expect(lessonStep('free', { type: 'HIT', hits: LESSON_AFTER_HIT.length })).toBe(
      'done',
    )
    expect(lessonStep('free', { type: 'HIT', hits: 20 })).toBe('done')
  })

  it('holds each gesture lesson until that gesture is made', () => {
    const asking = { swipeDown: 'down', swipeLeft: 'left', swipeRight: 'right' } as const
    for (const [step, swipe] of Object.entries(asking)) {
      const from = step as LessonStep
      expect(tapThrough(from, 5)).toBe(from)
      expect(lessonStep(from, { type: 'SWIPED', swipe })).toBe('free')
    }
  })

  it('takes no notice of the wrong swipe', () => {
    expect(lessonStep('swipeDown', { type: 'SWIPED', swipe: 'left' })).toBe('swipeDown')
    expect(lessonStep('swipeLeft', { type: 'SWIPED', swipe: 'down' })).toBe('swipeLeft')
    expect(lessonStep('swipeRight', { type: 'SWIPED', swipe: 'left' })).toBe('swipeRight')
  })

  it('takes no notice of a swipe it did not ask for', () => {
    for (const step of ['target', 'guided', 'congrats', 'free'] as const) {
      for (const swipe of ['down', 'left', 'right'] as const) {
        expect(lessonStep(step, { type: 'SWIPED', swipe })).toBe(step)
      }
    }
  })

  it('moves a gesture lesson on when the target goes down another way', () => {
    // A player who reaches the board without the gesture has still reached it, and the
    // banner would otherwise be left teaching a move for a target that has gone.
    expect(lessonStep('swipeDown', { type: 'HIT', hits: 3 })).toBe('swipeLeft')
  })

  it('stays ended, whatever happens next', () => {
    expect(tapThrough('done', 3)).toBe('done')
    expect(lessonStep('done', { type: 'HIT', hits: 2 })).toBe('done')
    expect(lessonStep('done', { type: 'SWIPED', swipe: 'down' })).toBe('done')
  })

  it('has one lesson for every board it deals, and one last word after them', () => {
    // Index 0 is the unread slot before any hit has landed; the tail is the sign-off, which
    // answers the hit that clears the final board rather than opening one of its own.
    expect(LESSON_AFTER_HIT).toHaveLength(TUTORIAL_TARGETS.length + 1)
  })

  it('takes a tap through exactly the steps that hold the dial', () => {
    const steps: LessonStep[] = [...STEPS]
    for (const step of steps) {
      expect(dismissedByTap(step)).toBe(LESSON_DIAL[step] === 'off')
    }
  })

  // What a rewind reads. The table's index 0 used to be dead — no hit lands at nought —
  // and the stepper going back to the opening board is the one thing that reads it. It
  // was already the right answer, which is why a rewind needs no second table.
  it('opens the board a rewind lands on from the same table a hit does', () => {
    expect(LESSON_AFTER_HIT[0]).toBe(FIRST_STEP)
  })
})

describe('the opening the lesson is built on', () => {
  // Everything below pins the pair in `TUTORIAL_OPENING_GRID` / TUTORIAL_OPENING_TARGET.
  // The lesson's whole first half is "tap the lit key" — so if the optimal route ever
  // stops being taps, or stops being three of them, the lesson is teaching the wrong
  // thing and this is what says so.
  const opening = (): { grid: Grid; target: number } => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'START', now: 0, tutorial: true })
    const { grid, targets } = actor.getSnapshot().context
    const target = targets[0]
    expect(target).toBeDefined()
    return { grid, target: target?.value ?? 0 }
  }

  it('opens holding one target, at the fixed value', () => {
    expect(opening().target).toBe(TUTORIAL_OPENING_TARGET)
  })

  it('opens on a board that is not nine zeros', () => {
    expect(computeSum(opening().grid)).toBe(185)
  })

  it('deals the same opening every time', () => {
    expect(opening()).toEqual(opening())
  })

  it('is three steps from the target', () => {
    const { grid, target } = opening()
    expect(computePar(grid, target)).toBe(3)
  })

  it('is reachable by taps alone, one key at a time, coarsest first', () => {
    let { grid } = opening()
    const { target } = opening()
    const pressed: number[] = []
    for (let i = 0; i < 3; i++) {
      const plan = computeKeyPlan(grid, target)
      const next = plan[0]
      expect(next).toBeDefined()
      if (next === undefined) return
      // A tap, once, upward — no swipe, and no key asked for twice in a row.
      expect(next.jump).toBeNull()
      expect(next.direction).toBe('up')
      expect(next.moves).toBe(1)
      pressed.push(next.weight)
      grid = buildPressGrid(grid, next.index, 1)
    }
    expect(computeSum(grid)).toBe(target)
    expect(pressed).toEqual([9, 6, 4])
  })
})

describe('what each step shows', () => {
  it('has words for exactly the steps that speak', () => {
    for (const step of STEPS) {
      expect(LESSON_LINE[step] === null).toBe(LESSON_VOICE[step] === 'silent')
    }
  })

  it('puts a clock on every step a clock can end, and on no other', () => {
    const untimed = STEPS.filter((step) => LESSON_HOLD_MS[step] === null)
    expect(untimed).toEqual([
      'target',
      'sum',
      'guided',
      'free',
      'swipeDown',
      'swipeLeft',
      'swipeRight',
      'done',
    ])
  })

  it('never puts a clock on a card that is holding the dial shut', () => {
    // A card up with the dial off is a card being waited for. Timing one away would hand
    // the board back to a player who had not finished reading it.
    for (const step of STEPS) {
      if (LESSON_DIAL[step] === 'off' && LESSON_VOICE[step] !== 'silent') {
        expect(LESSON_HOLD_MS[step]).toBeNull()
      }
    }
  })

  it('holds the dial shut until the route, and never again after it', () => {
    // Off through the opening beat and both tooltips — a press landing before the lesson
    // has said anything is a press it cannot then explain — and on from the route
    // onwards, one key at a time and then all nine.
    expect(STEPS.map((step) => LESSON_DIAL[step])).toEqual([
      'off',
      'off',
      'off',
      'one',
      'all',
      'all',
      'all',
      'all',
      'all',
      'all',
      'all',
    ])
  })
})

describe('keyControl', () => {
  it('hands every key the whole dial once the lesson is done talking', () => {
    expect(keyControl('all', null, 4)).toBe('full')
    expect(keyControl('all', 4, 0)).toBe('full')
  })

  it('shuts every key while a tooltip is being read', () => {
    expect(keyControl('off', null, 0)).toBe('off')
    expect(keyControl('off', 4, 4)).toBe('off')
  })

  it('opens the lit key to taps alone and shuts the rest', () => {
    expect(keyControl('one', 8, 8)).toBe('tap')
    expect(keyControl('one', 8, 7)).toBe('off')
  })

  it('shuts the dial rather than opening all of it when there is no key to light', () => {
    // A board that cannot reach its target has no next key. Falling back to `full` would
    // quietly hand the lesson's own step over to free play.
    expect(keyControl('one', null, 3)).toBe('off')
  })
})

describe('the second target the lesson deals', () => {
  // The board the guided route leaves, which is where the player takes over.
  const afterTheFirstHit = (): Grid => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'START', now: 0, tutorial: true })
    for (const index of [8, 7, 4]) {
      actor.send({ type: 'PRESS', index, delta: 1, now: 100 })
    }
    return actor.getSnapshot().context.grid
  }

  const second = () => TUTORIAL_TARGETS[1]

  it('sits above the sum the first hit leaves, so nothing has to come back down', () => {
    expect(second()).toBeGreaterThan(computeSum(afterTheFirstHit()))
  })

  it('is reachable by taps alone — the swipe is not taught yet', () => {
    const plan = computeKeyPlan(afterTheFirstHit(), second())
    expect(plan.length).toBeGreaterThan(0)
    for (const step of plan) {
      expect(step.jump).toBeNull()
      expect(step.direction).toBe('up')
    }
  })

  it('is a few taps away rather than one or a dozen', () => {
    expect(computePar(afterTheFirstHit(), second())).toBe(2)
  })

  it('asks for a coarse key and then the finest one', () => {
    const plan = computeKeyPlan(afterTheFirstHit(), second())
    expect(plan.map((step) => step.weight)).toEqual([6, 1])
  })
})

describe('the boards the script deals', () => {
  const [first, second, third, fourth, fifth] = TUTORIAL_TARGETS

  it('opens on the one the machine deals, and deals the rest itself', () => {
    expect(first).toBe(TUTORIAL_OPENING_TARGET)
    expect(scriptedTarget(0)).toBe(first)
    expect(scriptedTarget(1)).toBe(second)
    expect(scriptedTarget(2)).toBe(third)
    expect(scriptedTarget(3)).toBe(fourth)
    expect(scriptedTarget(4)).toBe(fifth)
  })

  it('hands the run back to the spawner once it has run out', () => {
    expect(scriptedTarget(TUTORIAL_TARGETS.length)).toBeNull()
    expect(scriptedTarget(20)).toBeNull()
  })

  // Each board has to ask for the move its lesson names, and the sum after a hit is known
  // exactly — it is the target just cleared — so each of these is checkable without knowing
  // what route the player took.
  it('puts the swipe-down board below the sum, so taps alone cannot reach it', () => {
    expect(third).toBeLessThan(second)
  })

  it('puts the swipe-left board far below, where stepping down is hopeless', () => {
    // Far enough that no plausible run of swipe-downs gets there: nine keys stepped down
    // once shed 36 between them, and this is several times that below.
    expect(third - fourth).toBeGreaterThan(3 * 36)
  })

  it('puts the swipe-right board far above, where stepping up is hopeless', () => {
    expect(fifth - fourth).toBeGreaterThan(3 * 36)
  })

  it('keeps every board inside the range a target can hold', () => {
    for (const target of TUTORIAL_TARGETS) {
      expect(target).toBeGreaterThanOrEqual(0)
      expect(target).toBeLessThanOrEqual(MAX_TARGET)
    }
  })
})
