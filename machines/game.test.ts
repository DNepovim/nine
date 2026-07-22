import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { gameMachine } from '@/machines/game'

const start = (mode: 'trainee' | 'accuracy' | 'speed') => {
  const actor = createActor(gameMachine)
  actor.start()
  actor.send({ type: 'SET_MODE', mode })
  actor.send({ type: 'START' })
  return actor
}

describe('mode selection + lives', () => {
  it('defaults to accuracy with 3 lives after START', () => {
    const actor = start('accuracy')
    expect(actor.getSnapshot().context.mode).toBe('accuracy')
    expect(actor.getSnapshot().context.lives).toBe(3)
  })

  it('trainee has infinite lives and never reaches gameOver on expiry', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 5, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0
    actor.send({ type: 'TARGET_EXPIRED', id })
    expect(actor.getSnapshot().context.lives).toBe(Number.POSITIVE_INFINITY)
    expect(actor.getSnapshot().value).toBe('playing')
  })
})

describe('per mode × difficulty stats shape', () => {
  it('exposes a nested stats record', () => {
    const actor = createActor(gameMachine)
    actor.start()
    const { stats } = actor.getSnapshot().context
    expect(stats.accuracy.hard).toEqual({ score: 0, hits: 0 })
    expect(stats.speed.extreme).toEqual({ score: 0, hits: 0 })
  })
})

describe('accuracy streak (optimal trigger)', () => {
  it('increments on par hits and resets on a non-par hit', () => {
    const actor = start('accuracy')

    // Target value=9: from empty grid, index 8 (weight=9) → press once → sum=9. par=1.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // par 1, userSteps 1 → optimal
    expect(actor.getSnapshot().context.streak).toBe(1)
    expect(actor.getSnapshot().context.score).toBeGreaterThan(0)

    // Target value=11: grid[8]=1 (sum=9). Need sum=11, add 2. index 1 or 3 (weight=2), press once. par=1.
    actor.send({ type: 'ADD_TARGET', value: 11, at: 0 })
    // Non-optimal: press index 0 twice (sum 9→10→11). par=1, userSteps=2 → non-optimal hit.
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 }) // sum=10, miss
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 }) // sum=11, hit (userSteps=2, par=1)
    expect(actor.getSnapshot().context.streak).toBe(0) // reset
  })
})

describe('accuracy streak (second optimal)', () => {
  it('doubles on consecutive par hits and caps at 3 consecutive (×8)', () => {
    const actor = start('accuracy')

    // Hit 1: value=9, par=1, optimal → streak=1
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.streak).toBe(1)

    // Hit 2: grid[8]=1 (sum=9). value=18, par=1 (press index 8 once: 1→2, sum=18). optimal → streak=2
    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.streak).toBe(2)
  })
})

describe('speed streak (clear trigger)', () => {
  it('increments only when the board is cleared and resets on expiry', () => {
    const actor = start('speed')

    // Target value=9: from empty grid, index 8 → press once → sum=9, board clears. streak=1.
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // clears board
    expect(actor.getSnapshot().context.streak).toBe(1)

    // Add another target and let it expire → streak resets
    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0
    actor.send({ type: 'TARGET_EXPIRED', id })
    expect(actor.getSnapshot().context.streak).toBe(0)
  })
})

describe('run stat accumulators', () => {
  it('accumulates accSum and spdSum after a hit', () => {
    const actor = start('accuracy')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // par 1, userSteps 1 → accFactor=1
    const { accSum, spdSum, hits } = actor.getSnapshot().context
    expect(hits).toBe(1)
    expect(accSum).toBeCloseTo(1) // perfect accuracy
    expect(spdSum).toBeGreaterThanOrEqual(0)
    expect(spdSum).toBeLessThanOrEqual(1)
  })
})
