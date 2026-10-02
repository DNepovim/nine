import { msg } from '@lingui/core/macro'
import { describe, expect, it } from 'vitest'

import { parTable } from '@/machines/scoring'
import { SPEED } from '@/modes/definitions/speed'
import { defineDial, emptyGrid } from '@/modes/dial'
import { DIFFICULTY_ORDER } from '@/modes/difficulty'
import { rulesFor } from '@/modes/registry'
import { resolveRules, spawnInterval } from '@/modes/rules'

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

  // The spawner draws from the whole of `0 … maxSum` and never asks whether the dial can
  // land on what it rolled — see `fullRange` in lib/target-value.ts. So a dial whose
  // weights share a factor spawns targets nobody can hit: four keys worth 3, 6, 9 and 12
  // reach only every third number, and two targets in three would be impossible.
  //
  // A property over the catalog rather than a figure for one entry, because it is the
  // rule a new challenge has to be designed against rather than a fact about this one.
  it('gives every challenge a dial that reaches every target it can spawn', () => {
    for (const mode of CHALLENGES) {
      if (mode.engine !== 'targets') throw new Error('a challenge runs on targets')
      const { dial } = resolveRules(mode.rules, mode.id, 'easy')
      const table = parTable(dial, emptyGrid(dial))
      const missed = []
      for (let target = 1; target <= dial.maxSum; target++) {
        if (!Number.isFinite(table[target] ?? Infinity)) missed.push(target)
      }
      expect(
        missed,
        `${mode.id} cannot reach ${missed.length} of its own targets`,
      ).toEqual([])
    }
  })

  // A challenge is one board for one day, so it pins its own rung and the intro shows no
  // difficulty row for it. The rung has to hold against whatever the screen hands in —
  // a stored difficulty from the last mode the player was on is exactly what arrives.
  it('pins every challenge to one rung, whatever difficulty is handed in', () => {
    for (const mode of CHALLENGES) {
      if (mode.engine !== 'targets') throw new Error('a challenge runs on targets')
      expect(mode.rules.fixedDifficulty, mode.id).not.toBeNull()
      const rungs = DIFFICULTY_ORDER.map((asked) =>
        resolveRules(mode.rules, mode.id, asked),
      )
      for (const rules of rungs) {
        expect(rules.difficulty, mode.id).toBe(mode.rules.fixedDifficulty)
        expect(rules.usesDifficulty, mode.id).toBe(false)
      }
      // And so the clock is one figure too, not three.
      expect(new Set(rungs.map((rules) => rules.clock.base)).size, mode.id).toBe(1)
    }
  })
})

describe('FOUR KEYS', () => {
  const FOUR_KEYS = CHALLENGES.find((mode) => mode.id === challengeId('four-keys'))

  it('gives a target 6750 ms — 9000 before the rung, halved from the 18 000 it opened at', () => {
    if (FOUR_KEYS?.engine !== 'targets') throw new Error('four keys runs on targets')
    const rules = resolveRules(FOUR_KEYS.rules, FOUR_KEYS.id, 'easy')
    // 9000 × Hard's 0.75. The figure in the catalog is the one before the scale, which
    // is the easy thing to misread when changing it.
    expect(rules.clock.base).toBe(6750)
    // Its own cap, not the rung's 3.
    expect(rules.spawn.maxTargets).toBe(2)
  })

  it('deals a target every quarter of the clock, tightening with the ramp', () => {
    if (FOUR_KEYS?.engine !== 'targets') throw new Error('four keys runs on targets')
    const rules = resolveRules(FOUR_KEYS.rules, FOUR_KEYS.id, 'easy')
    expect(rules.spawn.share).toBe(1 / 4)
    // A quarter of the 6750 a target opens on.
    expect(spawnInterval(rules, 0)).toBe(1688)
    // Speed ramps its clock, and the gap is a share of the clock a target gets *now* —
    // so the arrivals close up on their own as the run goes.
    expect(spawnInterval(rules, 40)).toBeLessThan(spawnInterval(rules, 0))
  })

  it('is four keys worth 1, 2, 2 and 4, reaching 81', () => {
    if (FOUR_KEYS?.engine !== 'targets') throw new Error('four keys runs on targets')
    const { dial } = resolveRules(FOUR_KEYS.rules, FOUR_KEYS.id, 'easy')
    expect(dial.weights).toEqual([1, 2, 2, 4])
    expect(dial.maxSum).toBe(9 * (1 + 2 + 2 + 4))
    expect(dial.maxSum).toBe(81)
  })
})
