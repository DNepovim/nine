import { describe, expect, it } from 'vitest'

import type { Target } from '@/machines/game'

import { remainingFraction } from './target-clock'

const target = (over: Partial<Target> = {}): Target => ({
  id: 1,
  value: 42,
  spawnedAt: 1_000,
  duration: 8_000,
  refAt: 1_000,
  refGrid: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  par: 3,
  userSteps: 0,
  ...over,
})

describe('remainingFraction', () => {
  it('reads a target that has just arrived as a full ring', () => {
    expect(remainingFraction(target(), 1_000)).toBe(1)
  })

  it('reads half a clock as half a ring', () => {
    expect(remainingFraction(target(), 5_000)).toBe(0.5)
  })

  it('never reports more than a full ring', () => {
    expect(remainingFraction(target(), 0)).toBe(1)
  })

  it('never reports less than an empty one', () => {
    expect(remainingFraction(target(), 100_000)).toBe(0)
  })

  it('treats a target with no clock as already run out', () => {
    expect(remainingFraction(target({ duration: 0 }), 1_000)).toBe(0)
  })
})
