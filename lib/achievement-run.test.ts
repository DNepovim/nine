import { describe, expect, it } from 'vitest'

import type { AchievementFacts, Award } from '@/lib/achievements'
import { emptyCareer, type Career } from '@/lib/career'
import type { HitInfo } from '@/machines/game'

import {
  dropAward,
  EMPTY_QUEUE,
  EMPTY_TALLY,
  foldBatch,
  IDLE,
  queueAwards,
  stepAchievements,
  stepQueue,
  tallyFor,
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
  guideRead: false,
  now: new Date('2026-09-17T12:00:00.000Z'),
  ...over,
})

const input = (over: Partial<RunInput> = {}): RunInput => ({
  inRun: true,
  runSeq: 0,
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
      runSeq: 0,
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

  it('catches an achievement only a finished run can answer', () => {
    // GOOSE EGG is the shape with no career fallback at all: nothing but the pass made
    // at game over can ever see it, so if that pass is lost the achievement is not late,
    // it is unreachable.
    const scoredNothing = (finished: boolean) =>
      input({ facts: worldFacts({ run: { ...worldFacts().run, finished } }) })

    const mid = stepAchievements(IDLE, scoredNothing(false))
    expect(mid.unlocked.map((a) => a.id)).not.toContain('gooseEgg')

    const over = stepAchievements(mid.phase, scoredNothing(true))
    expect(over.unlocked.map((a) => a.id)).toContain('gooseEgg')
  })

  it('drops the finished pass if the caller has already called the run over', () => {
    // The contract behind `inRun: inRun || isGameOver` at the hook's call site. Reaching
    // game over does not end the run as far as this is concerned — the finished pass is
    // part of it, and a caller that flips `inRun` first loses every achievement that
    // reads `finished`. This is exactly what shipped broken, and the phase machine
    // cannot tell the difference: from in here a run that is over is simply over.
    const mid = stepAchievements(IDLE, input())
    const over = stepAchievements(
      mid.phase,
      input({
        inRun: false,
        facts: worldFacts({ run: { ...worldFacts().run, finished: true } }),
      }),
    )
    expect(over.unlocked).toEqual([])
    expect(over.phase).toEqual(IDLE)
  })

  it('freezes the career again when the next run begins', () => {
    // PLAY AGAIN goes straight from gameOver to playing and RESTART never leaves it, so
    // `inRun` does not fall between two runs and the phase cannot wait for it. Told the
    // run's number, it starts over: the second run measures against the career as it
    // stood once the first was folded in, rather than against the one frozen before it.
    const first = stepAchievements(IDLE, withHits(20))
    expect(first.phase.career.hits).toBe(0)
    expect(first.phase.fired).toContain('firstHit')

    const folded = { ...emptyCareer(), hits: 20 }
    const next = stepAchievements(first.phase, {
      ...withHits(1, folded),
      runSeq: 1,
    })
    expect(next.phase.runSeq).toBe(1)
    expect(next.phase.career.hits).toBe(20)
  })
})

describe('foldBatch', () => {
  it('counts hits taken in exactly the optimal number of presses', () => {
    const tally = foldBatch(EMPTY_TALLY, {
      runSeq: 1,
      hits: [hit(3, 3), hit(5, 3)],
      totalHits: 2,
      livesFull: true,
    })
    expect(tally.parHits).toBe(1)
  })

  it('keeps the longest route any single hit took', () => {
    const tally = foldBatch(EMPTY_TALLY, {
      runSeq: 1,
      hits: [hit(31, 3), hit(4, 4)],
      totalHits: 2,
      livesFull: true,
    })
    expect(tally.longestRoute).toBe(31)
  })

  it('tracks the clean stretch as the run count while the lives are whole', () => {
    const tally = foldBatch(EMPTY_TALLY, {
      runSeq: 1,
      hits: [hit(3, 3)],
      totalHits: 12,
      livesFull: true,
    })
    expect(tally.cleanHits).toBe(12)
  })

  it('freezes the clean stretch the moment a life goes', () => {
    const clean = foldBatch(EMPTY_TALLY, {
      runSeq: 1,
      hits: [hit(3, 3)],
      totalHits: 12,
      livesFull: true,
    })
    const after = foldBatch(clean, {
      runSeq: 1,
      hits: [hit(3, 3)],
      totalHits: 20,
      livesFull: false,
    })
    expect(after.cleanHits).toBe(12)
    // The rest of the run still counts towards everything else.
    expect(after.parHits).toBe(2)
  })

  it('starts over for the next run rather than adding to the last one', () => {
    // What shipped broken. PLAY AGAIN never lets `inRun` fall, so the tally the hook
    // kept was cleared by nothing and every run added to the one before it: PERFECT
    // ROUTE, which wants 25 optimal hits in *one* run, was paying out on a chain of
    // them — and then on the next run too, on whichever board that one happened to be.
    const first = foldBatch(EMPTY_TALLY, {
      runSeq: 1,
      hits: [hit(3, 3), hit(4, 4), hit(9, 3)],
      totalHits: 3,
      livesFull: true,
    })
    expect(first.parHits).toBe(2)

    const next = foldBatch(first, {
      runSeq: 2,
      hits: [hit(3, 3)],
      totalHits: 1,
      livesFull: true,
    })
    expect(next.parHits).toBe(1)
    expect(next.cleanHits).toBe(1)
    expect(next.longestRoute).toBe(3)
  })
})

describe('tallyFor', () => {
  it('reads nothing off a run that is over', () => {
    // A new run that has landed no hits yet has no tally of its own — the ref still
    // holds the last one's. Asked for this run, it answers zeroes.
    const last = foldBatch(EMPTY_TALLY, {
      runSeq: 1,
      hits: [hit(3, 3)],
      totalHits: 30,
      livesFull: true,
    })
    expect(tallyFor(last, 1)).toBe(last)
    expect(tallyFor(last, 2)).toEqual(EMPTY_TALLY)
  })
})

describe('stepQueue', () => {
  const goose: Award = { id: 'gooseEgg', stage: null }
  const tenRuns: Award = { id: 'tenRuns', stage: null }

  it('holds an award for the bar while the run it was unlocked in is still on', () => {
    const queued = queueAwards(stepQueue(EMPTY_QUEUE, true), [tenRuns])
    expect(stepQueue(queued, true).waiting).toEqual([tenRuns])
  })

  it('drops what the last run left behind the moment the next one starts', () => {
    // GOOSE EGG is unlocked by the pass made at game over, when the bar is already gone,
    // so it can only ever be a leftover — and the leftover was taking the bar of the
    // *next* run, seconds after the game-over screen had already paid it out.
    const over = queueAwards(EMPTY_QUEUE, [goose])
    expect(stepQueue(over, true).waiting).toEqual([])
  })

  it('leaves a leftover be while no run is on', () => {
    // Nothing can take the bar between runs anyway, and the queue is not what the
    // game-over screen reads — so there is nothing to gain by emptying it early.
    const over = queueAwards(EMPTY_QUEUE, [goose])
    expect(stepQueue(over, false).waiting).toEqual([goose])
  })

  it('steps a write as well as a read, so a leftover cannot ride in on a push', () => {
    // The whole point of the boundary living in the value: a run that starts and then
    // unlocks something must not hand the bar the last run's award first.
    const over = queueAwards(EMPTY_QUEUE, [goose])
    const next = queueAwards(stepQueue(over, true), [tenRuns])
    expect(next.waiting).toEqual([tenRuns])
  })

  it('drops an award once it has had its turn', () => {
    const queued = queueAwards(stepQueue(EMPTY_QUEUE, true), [tenRuns, goose])
    expect(dropAward(queued, tenRuns).waiting).toEqual([goose])
  })
})
