import { msg } from '@lingui/core/macro'
import { describe, expect, it } from 'vitest'

import { SPEED } from '@/modes/definitions/speed'
import { defineDial } from '@/modes/dial'
import { rulesFor } from '@/modes/registry'
import { resolveRules } from '@/modes/rules'

import { CHALLENGES } from './catalog'
import { challengeId, defineChallenge, isOpenMode } from './define'

const DAY = 24 * 3600_000
const OPENS = Date.UTC(2027, 0, 1)

// A challenge bending every group a challenge may bend, which is the shape the catalog's
// own entry has and the thing a new one is copied from.
const EVERYTHING = defineChallenge({
  slug: 'everything',
  label: msg`EVERYTHING`,
  description: msg`One of each.`,
  base: SPEED,
  from: OPENS,
  until: OPENS + DAY,
  rules: {
    dial: defineDial({ id: 'two-by-four', rows: 2, cols: 4, digits: 6 }),
    fixedDifficulty: 'extreme',
    clock: { base: 9000, ramps: 'spawn', playerSet: true, countsDown: false },
    spawn: { share: 0.5, cap: 4000, maxTargets: 6, cadence: false, reach: 40 },
    scoring: { weights: { acc: 1, spd: 0 }, base: 250, streak: 'clear', headline: 'acc' },
    lives: { count: 1, wastefulCostsLife: true, expiryCostsLife: false },
    capabilities: { scored: false, coached: true, keyHints: true },
  },
})

describe('defineChallenge', () => {
  it('namespaces the id so it can never collide with a permanent mode', () => {
    expect(EVERYTHING.id).toBe(challengeId('everything'))
    expect(EVERYTHING.id.startsWith('challenge/')).toBe(true)
  })

  it('borrows the base mode’s colours and shot unless the spec names its own', () => {
    expect(EVERYTHING.gradient).toEqual(SPEED.gradient)
    expect(EVERYTHING.darkGradient).toEqual(SPEED.darkGradient)
    expect(EVERYTHING.shot).toBe(SPEED.shot)
  })

  it('carries every rule the patch names through to a resolved run', () => {
    if (EVERYTHING.engine !== 'targets') throw new Error('a challenge runs on targets')
    // The rung the challenge fixes, not the one handed in — which is the whole point of
    // a mode being allowed to pin one.
    const rules = resolveRules(EVERYTHING.rules, EVERYTHING.id, 'easy')
    expect(rules.difficulty).toBe('extreme')
    expect(rules.usesDifficulty).toBe(false)
    expect(rules.dial.rows).toBe(2)
    expect(rules.dial.cols).toBe(4)
    expect(rules.dial.digits).toBe(6)
    // Two rows of four, weighted row × column: 1 2 3 4 / 2 4 6 8, each key to five.
    expect(rules.dial.maxSum).toBe(5 * 30)
    // 9000 × Extreme's 0.5.
    expect(rules.clock.base).toBe(4500)
    expect(rules.clock.ramps).toBe('spawn')
    expect(rules.clock.playerSet).toBe(true)
    expect(rules.clock.countsDown).toBe(false)
    expect(rules.spawn).toEqual({
      share: 0.5,
      cap: 4000,
      maxTargets: 6,
      cadence: false,
      reach: 40,
    })
    expect(rules.scoring.base).toBe(250)
    expect(rules.scoring.streak).toBe('clear')
    expect(rules.lives.count).toBe(1)
    expect(rules.lives.wasteful).toBeCloseTo(0.15)
    expect(rules.lives.expiryCosts).toBe(false)
    expect(rules.capabilities).toEqual({ scored: false, coached: true, keyHints: true })
  })

  it('leaves everything the patch is silent about as the base mode had it', () => {
    const bare = defineChallenge({
      slug: 'bare',
      label: msg`BARE`,
      description: msg`Nothing changed.`,
      base: SPEED,
      from: OPENS,
      until: OPENS + DAY,
    })
    if (bare.engine !== 'targets') throw new Error('a challenge runs on targets')
    const asSpeed = rulesFor('speed', 'hard')
    const asChallenge = resolveRules(bare.rules, 'speed', 'hard')
    expect(asChallenge).toEqual(asSpeed)
  })

  it('is open inside its window and closed either side of it', () => {
    expect(isOpenMode(EVERYTHING, OPENS - 1)).toBe(false)
    expect(isOpenMode(EVERYTHING, OPENS)).toBe(true)
    expect(isOpenMode(EVERYTHING, OPENS + DAY - 1)).toBe(true)
    expect(isOpenMode(EVERYTHING, OPENS + DAY)).toBe(false)
  })
})

describe('the catalog', () => {
  it('gives every challenge a window and a namespaced id', () => {
    for (const mode of CHALLENGES) {
      expect(mode.window, mode.id).not.toBeNull()
      expect(mode.id.startsWith('challenge/'), mode.id).toBe(true)
      expect((mode.window?.until ?? 0) > (mode.window?.from ?? 0), mode.id).toBe(true)
    }
  })

  it('names each one once, so a stored run can only mean one thing', () => {
    const ids = CHALLENGES.map((mode) => mode.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every one on the game machine’s engine', () => {
    for (const mode of CHALLENGES) expect(mode.engine, mode.id).toBe('targets')
  })
})
