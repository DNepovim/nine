import { describe, expect, it } from 'vitest'

import type { AchievementFacts } from '@/lib/achievements'
import { emptyCareer, type Career } from '@/lib/career'
import type { HitInfo } from '@/machines/game'

import {
  EMPTY_TALLY,
  foldBatch,
  IDLE,
  stepAchievements,
  type AchievementPhase,
  type RunInput,
} from './achievement-run'

const emptyStats = () => {
  const board = { score: 0, hits: 0 }
  const perDifficulty = () => ({ easy: board, hard: board, extreme: board })
  return {
    trainee: perDifficulty(),
    accuracy: perDifficulty(),
    speed: perDifficulty(),
  }
}

const worldFacts = (
  over: Partial<Omit<AchievementFacts, 'career'>> = {},
): Omit<AchievementFacts, 'career'> => ({
  stats: emptyStats(),
  run: {
    mode: 'accuracy',
    difficulty: 'easy',
    score: 0,
    hits: 0,
    maxStreak: 0,
    cleanHits: 0,
    parHits: 0,
    longestRoute: 0,
    elapsedMs: 0,
    avgAccuracy: 0,
    avgSpeed: 0,
    personalBest: false,
    finished: false,
    endedAt: new Date('2026-09-17T12:00:00.000Z'),
  },
  standings: [],
  crown: false,
  crossed: [],
  tutorialDone: false,
  now: new Date('2026-09-17T12:00:00.000Z'),
  ...over,
})

const input = (over: Partial<RunInput> = {}): RunInput => ({
  inRun: true,
  ready: true,
  career: emptyCareer(),
  facts: worldFacts(),
  held: [],
  ...over,
})

const withHits = (hits: number, career?: Career): RunInput =>
  input({
    career: career ?? emptyCareer(),
    facts: worldFacts({ run: { ...worldFacts().run, hits } }),
  })

const hit = (steps: number, par: number): HitInfo => ({
  points: 10,
  progress: 1,
  bonus: false,
  multiplier: 1,
  accFactor: 1,
  spdFactor: 1,
  steps,
  par,
  refGrid: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  value: 12,
  costLife: false,
})

describe('stepAchievements', () => {
  it('goes back to idle when the run is over', () => {
    const started: AchievementPhase = {
      started: true,
      career: emptyCareer(),
      fired: ['firstHit'],
    }
    expect(stepAchievements(started, input({ inRun: false })).phase).toEqual(IDLE)
  })

  it('freezes nothing, and says nothing, before the career has been read', () => {
    const step = stepAchievements(IDLE, { ...withHits(1), ready: false })
    expect(step.unlocked).toEqual([])
    expect(step.phase.started).toBe(false)
  })

  it('measures what the run has already done at the moment it freezes', () => {
    // A career that lands late: the run is 5 hits in before anything is frozen, and the
    // first hit must still count.
    const step = stepAchievements(IDLE, withHits(5))
    expect(step.phase.started).toBe(true)
    expect(step.unlocked.map((a) => a.id)).toContain('firstHit')
  })

  it('announces an achievement once, however many hits land past it', () => {
    const first = stepAchievements(IDLE, withHits(1))
    expect(first.unlocked.map((a) => a.id)).toContain('firstHit')
    const second = stepAchievements(first.phase, withHits(2))
    expect(second.unlocked.map((a) => a.id)).not.toContain('firstHit')
  })

  it('stays silent about an achievement the store already holds', () => {
    const step = stepAchievements(IDLE, { ...withHits(1), held: ['firstHit'] })
    expect(step.unlocked.map((a) => a.id)).not.toContain('firstHit')
  })

  it('stays silent about it on the next hit too', () => {
    const first = stepAchievements(IDLE, { ...withHits(1), held: ['firstHit'] })
    const second = stepAchievements(first.phase, withHits(2))
    expect(second.unlocked.map((a) => a.id)).not.toContain('firstHit')
  })

  it('ignores a career that moves once the run is under way', () => {
    // 995 lifetime hits would put THOUSAND HITS in reach; frozen at zero, it is not.
    const started = stepAchievements(IDLE, withHits(1)).phase
    const moved = stepAchievements(started, withHits(5, { ...emptyCareer(), hits: 995 }))
    expect(moved.unlocked.map((a) => a.id)).not.toContain('thousandHits')
    expect(moved.phase.career.hits).toBe(0)
  })

  it('hands back the same phase when nothing is new', () => {
    const first = stepAchievements(IDLE, withHits(1))
    const second = stepAchievements(first.phase, withHits(1))
    expect(second.phase).toBe(first.phase)
    expect(second.unlocked).toEqual([])
  })

  it('catches a run-count achievement on the finished pass', () => {
    const nine = { ...emptyCareer(), runs: 9 }
    const mid = stepAchievements(
      IDLE,
      input({
        career: nine,
        facts: worldFacts({ run: { ...worldFacts().run, hits: 3 } }),
      }),
    )
    expect(mid.unlocked.map((a) => a.id)).not.toContain('tenRuns')

    const over = stepAchievements(
      mid.phase,
      input({
        career: nine,
        facts: worldFacts({ run: { ...worldFacts().run, hits: 3, finished: true } }),
      }),
    )
    expect(over.unlocked.map((a) => a.id)).toContain('tenRuns')
  })
})

describe('foldBatch', () => {
  it('counts hits taken in exactly the optimal number of presses', () => {
    const tally = foldBatch(EMPTY_TALLY, {
      hits: [hit(3, 3), hit(5, 3)],
      totalHits: 2,
      livesFull: true,
    })
    expect(tally.parHits).toBe(1)
  })

  it('keeps the longest route any single hit took', () => {
    const tally = foldBatch(EMPTY_TALLY, {
      hits: [hit(31, 3), hit(4, 4)],
      totalHits: 2,
      livesFull: true,
    })
    expect(tally.longestRoute).toBe(31)
  })

  it('tracks the clean stretch as the run count while the lives are whole', () => {
    const tally = foldBatch(EMPTY_TALLY, {
      hits: [hit(3, 3)],
      totalHits: 12,
      livesFull: true,
    })
    expect(tally.cleanHits).toBe(12)
  })

  it('freezes the clean stretch the moment a life goes', () => {
    const clean = foldBatch(EMPTY_TALLY, {
      hits: [hit(3, 3)],
      totalHits: 12,
      livesFull: true,
    })
    const after = foldBatch(clean, {
      hits: [hit(3, 3)],
      totalHits: 20,
      livesFull: false,
    })
    expect(after.cleanHits).toBe(12)
    // The rest of the run still counts towards everything else.
    expect(after.parHits).toBe(2)
  })
})
