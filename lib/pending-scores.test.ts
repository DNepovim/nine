import { describe, expect, it } from 'vitest'

import {
  bestPendingScore,
  dedupePending,
  mergePending,
  type PendingScore,
} from './pending-scores'

// A Wednesday, so its Monday-to-Sunday week has days either side of it.
const TODAY = '2026-08-12'

const entry = (over: Partial<PendingScore> = {}): PendingScore => ({
  mode: 'speed',
  difficulty: 'hard',
  score: 1000,
  hits: 10,
  day: TODAY,
  achievedAt: `${TODAY}T10:00:00.000Z`,
  ...over,
})

describe('bestPendingScore', () => {
  it('returns null for an empty queue', () => {
    expect(bestPendingScore([], 'speed', 'hard', 'forever', TODAY)).toBeNull()
  })

  it('takes the highest score on the board', () => {
    const queue = [entry({ score: 900 }), entry({ score: 1400 }), entry({ score: 1100 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'forever', TODAY)).toBe(1400)
  })

  it('ignores other modes', () => {
    const queue = [entry({ mode: 'accuracy', score: 5000 }), entry({ score: 800 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })

  it('ignores other difficulties', () => {
    const queue = [entry({ difficulty: 'easy', score: 5000 }), entry({ score: 800 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })

  it('excludes older days from today', () => {
    const queue = [entry({ day: '2026-08-09', score: 5000 }), entry({ score: 800 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'today', TODAY)).toBe(800)
  })

  it('includes earlier days from the same calendar week', () => {
    // TODAY is Wednesday; Monday opened its week.
    const queue = [entry({ day: '2026-08-10', score: 5000 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'week', TODAY)).toBe(5000)
  })

  it('excludes the previous week, even a day that is only three days old', () => {
    // Sunday 2026-08-09 closed the previous week.
    const queue = [entry({ day: '2026-08-09', score: 5000 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'week', TODAY)).toBeNull()
  })

  it('keeps old days under all time', () => {
    const queue = [entry({ day: '2019-01-01', score: 5000 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'forever', TODAY)).toBe(5000)
  })
})

describe('mergePending', () => {
  it('keeps a run that has no rival on its board', () => {
    const added = entry({ score: 700 })
    expect(mergePending([], added)).toEqual([added])
  })

  it('replaces a beaten record, keeping the moment the better one was earned', () => {
    const beaten = entry({ score: 700, achievedAt: `${TODAY}T09:00:00.000Z` })
    const better = entry({ score: 900, achievedAt: `${TODAY}T11:00:00.000Z` })
    expect(mergePending([beaten], better)).toEqual([better])
  })

  it('drops a run that beats nothing', () => {
    const held = entry({ score: 900 })
    expect(mergePending([held], entry({ score: 400 }))).toEqual([held])
  })

  it('drops a run that only matches the record', () => {
    const held = entry({ score: 900, achievedAt: `${TODAY}T09:00:00.000Z` })
    expect(mergePending([held], entry({ score: 900 }))).toEqual([held])
  })

  it('keeps the same score on another day', () => {
    const yesterday = entry({ day: '2026-08-11' })
    const today = entry()
    expect(mergePending([yesterday], today)).toEqual([yesterday, today])
  })

  it('keeps the same score on another board', () => {
    const speed = entry()
    const accuracy = entry({ mode: 'accuracy' })
    expect(mergePending([speed], accuracy)).toEqual([speed, accuracy])
  })

  it('returns the queue untouched when nothing changes', () => {
    const queue = [entry({ score: 900 })]
    expect(mergePending(queue, entry({ score: 400 }))).toBe(queue)
  })
})

describe('dedupePending', () => {
  it('collapses a run log into one record per board per day', () => {
    const best = entry({ score: 1200 })
    const queue = [entry({ score: 300 }), best, entry({ score: 800 })]
    expect(dedupePending(queue)).toEqual([best])
  })

  it('leaves a queue that is already one record per board alone', () => {
    const queue = [entry(), entry({ difficulty: 'easy' })]
    expect(dedupePending(queue)).toEqual(queue)
  })
})
