import { msg } from '@lingui/core/macro'
import { describe, expect, it } from 'vitest'

import { parTable } from '@/machines/scoring'
import { ACCURACY } from '@/modes/definitions/accuracy'
import { SPEED } from '@/modes/definitions/speed'
import { defineDial, emptyGrid } from '@/modes/dial'
import { DIFFICULTY_ORDER } from '@/modes/difficulty'
import { measureOf, rulesFor, runRules } from '@/modes/registry'
import { rampedTimeout, resolveRules, spawnInterval } from '@/modes/rules'

import { CHALLENGES } from './catalog'
import { challengeId, defineChallenge, isOpenMode } from './define'
import { challengeDarkGradient, challengeGradient } from './palette'

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

  it('borrows the base mode’s shot unless the spec names its own', () => {
    expect(EVERYTHING.shot).toBe(SPEED.shot)
  })

  it('takes a colour of its own rather than the base mode’s', () => {
    // This is the behaviour that replaced colour inheritance, and the reason it had to:
    // a challenge built on SPEED came out wearing Speed's exact pair, so the one thing
    // on the intro that is only there today was the hardest thing on it to tell from a
    // permanent mode.
    expect(EVERYTHING.gradient).not.toEqual(SPEED.gradient)
    expect(EVERYTHING.darkGradient).not.toEqual(SPEED.darkGradient)
    expect(EVERYTHING.gradient).toEqual(challengeGradient(0))
    expect(EVERYTHING.darkGradient).toEqual(challengeDarkGradient(0))
  })

  it('still lets a spec name its own pair', () => {
    const painted = defineChallenge({
      slug: 'painted',
      label: msg`PAINTED`,
      description: msg`Picks its own.`,
      base: SPEED,
      from: OPENS,
      until: OPENS + DAY,
      gradient: ['#111111', '#222222'],
      darkGradient: ['#333333', '#444444'],
    })
    expect(painted.gradient).toEqual(['#111111', '#222222'])
    expect(painted.darkGradient).toEqual(['#333333', '#444444'])
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
      // Not in the patch, so the base's own answer: this challenge rolls its targets
      // like every mode but a drilled one.
      drill: null,
    })
    expect(rules.scoring.base).toBe(250)
    expect(rules.scoring.streak).toBe('clear')
    expect(rules.lives.count).toBe(1)
    expect(rules.lives.wasteful).toBeCloseTo(0.15)
    expect(rules.lives.expiryCosts).toBe(false)
    expect(rules.capabilities).toEqual({
      // `board` is not in the patch above and never can be — `defineChallenge` forces
      // it off after the merge, whatever the spec says.
      board: false,
      scored: false,
      coached: true,
      keyHints: true,
    })
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
    if (asSpeed === null) throw new Error('speed resolves')

    // Three fields a bare challenge does not inherit, and nothing else. Each is deliberate
    // and each is written down in `define.ts`:
    //
    //   **board** — forced off. Its standings belong to the session it was aired in.
    //   **weights** and **streak** — Accuracy's, whichever mode it was built from.
    //   **wasteful** — off. A day to work out a strange dial is not a day to be fined for
    //   not already knowing it.
    //
    // The assertion is written as "put those back and it is the base mode", which
    // is what makes it fail if a fourth ever joins them quietly.
    expect(asSpeed.capabilities.board).toBe(true)
    expect(asChallenge.capabilities.board).toBe(false)
    expect(asChallenge.scoring.weights).toEqual({ acc: 0.85, spd: 0.15 })
    expect(asChallenge.scoring.streak).toBe('optimal')
    expect(asChallenge.lives.wasteful).toBeNull()

    expect({
      ...asChallenge,
      capabilities: { ...asChallenge.capabilities, board: true },
      scoring: {
        ...asChallenge.scoring,
        weights: asSpeed.scoring.weights,
        headline: asSpeed.scoring.headline,
        streak: asSpeed.scoring.streak,
      },
      lives: { ...asChallenge.lives, wasteful: asSpeed.lives.wasteful },
    }).toEqual(asSpeed)
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

describe('FOUR BY FOUR', () => {
  const FOUR_BY_FOUR = CHALLENGES.find((mode) => mode.id === challengeId('four-by-four'))

  it('gives a target 8250 ms — 11 000 before the rung, half of Accuracy’s 22 000', () => {
    if (FOUR_BY_FOUR?.engine !== 'targets')
      throw new Error('four by four runs on targets')
    const rules = resolveRules(FOUR_BY_FOUR.rules, FOUR_BY_FOUR.id, 'easy')
    // Double time means half the ring the game at rest gives a target, which is what the
    // 11 000 in the catalog is half of. The figure here is after Hard's 0.75.
    expect(rules.clock.base).toBe(8250)
    // The ring never closes in, because the base mode is Accuracy: the clock a target
    // gets forty hits in is the clock the first one got. What tightens is below.
    expect(rules.clock.ramps).toBe('spawn')
    expect(rampedTimeout(rules, 40)).toBe(rules.clock.base)
    // The rung's three, not one of its own.
    expect(rules.spawn.maxTargets).toBe(3)
  })

  it('deals a target every third of that clock, and closes the gap as the run goes', () => {
    if (FOUR_BY_FOUR?.engine !== 'targets')
      throw new Error('four by four runs on targets')
    const rules = resolveRules(FOUR_BY_FOUR.rules, FOUR_BY_FOUR.id, 'easy')
    expect(rules.spawn.share).toBeCloseTo(1 / 3)
    expect(spawnInterval(rules, 0)).toBe(2750)
    // Accuracy's own ramp, inherited: the ring holds and the arrivals close up, which is
    // the only thing here that gets harder on its own and so the thing that ends a run.
    // FOUR KEYS tightens the other one — its clock — and its gap follows that down.
    expect(spawnInterval(rules, 40)).toBeLessThan(spawnInterval(rules, 0))
  })

  it('is sixteen keys weighted row × column, reaching 900', () => {
    if (FOUR_BY_FOUR?.engine !== 'targets')
      throw new Error('four by four runs on targets')
    const { dial } = resolveRules(FOUR_BY_FOUR.rules, FOUR_BY_FOUR.id, 'easy')
    expect(dial.rows).toBe(4)
    expect(dial.cols).toBe(4)
    expect(dial.weights).toEqual([1, 2, 3, 4, 2, 4, 6, 8, 3, 6, 9, 12, 4, 8, 12, 16])
    // 9 × (1 + 2 + 3 + 4)², which is the dial's own rule rather than a figure to keep.
    expect(dial.maxSum).toBe(9 * 100)
  })

  it('builds its chain the way Accuracy does, and prints no key weights', () => {
    if (FOUR_BY_FOUR?.engine !== 'targets')
      throw new Error('four by four runs on targets')
    const rules = resolveRules(FOUR_BY_FOUR.rules, FOUR_BY_FOUR.id, 'easy')
    // Inherited from the base mode rather than named here: the cheapest route to the
    // target, which is the rule every Accuracy run is already played under. It asked for
    // `spread` once — a key moved in every row — and that pulled against the score on a
    // dial the player is still working out.
    expect(rules.scoring.streak).toBe('optimal')
    expect(rules.capabilities.keyHints).toBe(false)
    // Accuracy's 85/15 lean and the ordinary hundred, both a challenge's defaults.
    expect(rules.scoring.weights).toEqual({ acc: 0.85, spd: 0.15 })
    expect(rules.scoring.base).toBe(100)
  })

  it('draws nothing when a hit lands', () => {
    // The one challenge that names `null` rather than inheriting a shot: there is no kind
    // that draws this streak, and a beam per key would be sixteen of them.
    expect(FOUR_BY_FOUR?.shot).toBeNull()
  })
})

describe('habit', () => {
  const HABIT = CHALLENGES.find((mode) => mode.id === challengeId('habit'))

  it('deals a drill of nine and lets all nine stand', () => {
    if (HABIT?.engine !== 'targets') throw new Error('habit runs on targets')
    const rules = resolveRules(HABIT.rules, HABIT.id, 'easy')
    expect(rules.spawn.drill).toBe(9)
    // The two have to agree. `ADD_TARGET` refuses a deal that would overflow the board,
    // and a drilled run that lost a target could never reach nine and so never end.
    expect(rules.spawn.maxTargets).toBe(9)
    // Half a second apart, whatever the clock works out to.
    expect(spawnInterval(rules, 0)).toBe(500)
  })

  it('takes the ring off every target and spends no lives', () => {
    if (HABIT?.engine !== 'targets') throw new Error('habit runs on targets')
    const rules = resolveRules(HABIT.rules, HABIT.id, 'easy')
    expect(rules.clock.countsDown).toBe(false)
    expect(rules.lives.count).toBe(Number.POSITIVE_INFINITY)
    expect(rules.lives.expiryCosts).toBe(false)
    // Which is what takes the hearts off the top bar: it draws `lives.count` of them.
    expect(rules.lives.wasteful).toBeNull()
  })

  it('scores on the route alone, because the clock is the contest', () => {
    if (HABIT?.engine !== 'targets') throw new Error('habit runs on targets')
    const rules = resolveRules(HABIT.rules, HABIT.id, 'easy')
    // Not the Accuracy blend every other challenge defaults to. With `countsDown: false`
    // the speed factor is a constant 1, so fifteen points of every hit would be free.
    expect(rules.scoring.weights).toEqual({ acc: 1, spd: 0 })
    expect(rules.scoring.headline).toBe('acc')
    expect(rules.scoring.streak).toBe('optimal')
  })

  it('is the one mode whose standings are ordered by the clock', () => {
    expect(measureOf(challengeId('habit'))).toBe('time')
    expect(measureOf(challengeId('four-keys'))).toBe('score')
    expect(measureOf('accuracy')).toBe('score')
    // A mode nothing is registered under, which is every session booked before a
    // measure existed.
    expect(measureOf('nothing-here')).toBe('score')
  })

  it('pins Hard and keeps no board, like every challenge', () => {
    if (HABIT?.engine !== 'targets') throw new Error('habit runs on targets')
    const rules = resolveRules(HABIT.rules, HABIT.id, 'easy')
    expect(rules.difficulty).toBe('hard')
    expect(rules.usesDifficulty).toBe(false)
    expect(rules.capabilities.board).toBe(false)
    expect(rules.capabilities.scored).toBe(true)
  })

  it('draws its strike as the route it walked', () => {
    expect(HABIT?.shot).toBe('chain')
  })
})

describe('a challenge and the board it does not keep', () => {
  it('is scored but keeps no board, with no spec saying so', () => {
    // The whole of the split, on the catalog's own entry — which names no capabilities
    // at all, so both answers come from `defineChallenge` and the base mode rather than
    // from the spec. A challenge run has a figure worth showing and counting, and no
    // mode × difficulty leaderboard behind it.
    const fourKeys = CHALLENGES.find((mode) => mode.id === challengeId('four-keys'))
    if (fourKeys?.engine !== 'targets') throw new Error('four keys runs on targets')
    expect(fourKeys.rules.capabilities.board).toBe(false)
    expect(fourKeys.rules.capabilities.scored).toBe(true)
  })

  it('refuses a spec that claims a board, whatever else the patch says', () => {
    // Review focus 2. `patchRules` merges capabilities, so a force applied to the base
    // rather than to the result would be overwritten by exactly this spec — and the
    // catalog's own entry names no capabilities, so the wrong order would have shipped
    // green and failed on the second challenge anybody wrote.
    const greedy = defineChallenge({
      slug: 'greedy',
      label: msg`GREEDY`,
      description: msg`Wants a board it cannot have.`,
      base: SPEED,
      from: OPENS,
      until: OPENS + DAY,
      rules: { capabilities: { board: true, coached: true } },
    })
    if (greedy.engine !== 'targets') throw new Error('greedy runs on targets')
    expect(greedy.rules.capabilities.board).toBe(false)
    // And the rest of the patch is untouched — the force is one field, not a reset.
    expect(greedy.rules.capabilities.coached).toBe(true)
  })

  it('keeps every challenge in the catalog off the boards', () => {
    // A sweep rather than one example, so a hand-written entry cannot slip past.
    for (const challenge of CHALLENGES) {
      if (challenge.engine !== 'targets') continue
      expect(challenge.rules.capabilities.board).toBe(false)
    }
  })
})

describe('what a challenge is scored and spent by unless it says otherwise', () => {
  it('counts like Accuracy, whichever mode it was built on', () => {
    // SPEED leans 85/15 towards the clock. A challenge built on it inherited that lean
    // and was quietly a Speed run with a different dial.
    const onSpeed = defineChallenge({
      slug: 'on-speed',
      label: msg`ON SPEED`,
      description: msg`Built on speed.`,
      base: SPEED,
      from: OPENS,
      until: OPENS + DAY,
    })
    if (onSpeed.engine !== 'targets') throw new Error('targets')
    expect(onSpeed.rules.scoring.weights).toEqual(ACCURACY.rules.scoring.weights)
    expect(onSpeed.rules.scoring.streak).toBe('optimal')
    expect(SPEED.rules.scoring.streak).not.toBe('optimal')
  })

  it('costs no life for a wasteful hit, whichever mode it was built on', () => {
    // ACCURACY spends one, which is the rule that board is about. A challenge is strange
    // in several ways at once and gives a day to work them out.
    const onAccuracy = defineChallenge({
      slug: 'on-accuracy',
      label: msg`ON ACCURACY`,
      description: msg`Built on accuracy.`,
      base: ACCURACY,
      from: OPENS,
      until: OPENS + DAY,
    })
    if (onAccuracy.engine !== 'targets') throw new Error('targets')
    expect(onAccuracy.rules.lives.wastefulCostsLife).toBe(false)
    expect(ACCURACY.rules.lives.wastefulCostsLife).toBe(true)
    // The clock still takes one. A life going to an expiry is the clock doing its job.
    expect(onAccuracy.rules.lives.expiryCostsLife).toBe(true)
  })

  it('lets a spec ask for a lean of its own', () => {
    // Defaults, not forces — unlike the board, which no challenge may keep.
    const leaning = defineChallenge({
      slug: 'leaning',
      label: msg`LEANING`,
      description: msg`Wants the clock to matter.`,
      base: SPEED,
      from: OPENS,
      until: OPENS + DAY,
      rules: {
        scoring: { weights: { acc: 0.2, spd: 0.8 } },
        lives: { wastefulCostsLife: true },
      },
    })
    if (leaning.engine !== 'targets') throw new Error('targets')
    expect(leaning.rules.scoring.weights).toEqual({ acc: 0.2, spd: 0.8 })
    expect(leaning.rules.lives.wastefulCostsLife).toBe(true)
  })

  it('reads the Accuracy blend as a run about the route', () => {
    // The blend leans towards the route, so a challenge leads its stats with it rather
    // than with the clock.
    expect(runRules(challengeId('four-keys'), 'hard').scoring.headline).toBe('acc')
    expect(runRules(challengeId('four-keys'), 'hard').scoring.weights).toEqual({
      acc: 0.85,
      spd: 0.15,
    })
  })
})
