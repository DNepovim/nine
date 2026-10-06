import { describe, expect, it } from 'vitest'

import { idSeed, pickFrom, seeded } from '@/lib/rng'

// The numbers below are not chosen, they are recorded — what the generator produced on the
// day it moved out of machines/arcade.ts. That is the whole point of this file: every
// arcade map ever grown is a function of these two, so a tidier implementation that returns
// different numbers is not a tidier implementation, it is a different game. If one of these
// fails, the fix is to put the old arithmetic back.

describe('seeded', () => {
  it('gives the sequence the arcade maps were grown from', () => {
    const rng = seeded(42)
    expect([rng(), rng(), rng()]).toEqual([
      0.2523451747838408, 0.08812504541128874, 0.5772811982315034,
    ])
  })

  it('gives the same sequence for the same seed', () => {
    const a = seeded(7)
    const b = seeded(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('stays inside the unit interval', () => {
    const rng = seeded(1)
    for (let i = 0; i < 500; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('idSeed', () => {
  it('gives the hash the crossroads were keyed on', () => {
    expect(idSeed('')).toBe(2166136261)
    expect(idSeed('1.2.0')).toBe(431764546)
  })

  it('separates ids that differ in one character', () => {
    expect(idSeed('1.0')).not.toBe(idSeed('1.1'))
  })
})

describe('pickFrom', () => {
  it('returns the option the roll lands on', () => {
    const options = ['a', 'b', 'c', 'd'] as const
    expect(pickFrom(() => 0, options)).toBe('a')
    expect(pickFrom(() => 0.5, options)).toBe('c')
    // A generator is specified to stay below 1, but one that did not would otherwise index
    // off the end and return undefined — which the non-empty tuple promises it never does.
    expect(pickFrom(() => 1, options)).toBe('a')
  })
})
