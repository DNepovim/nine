import { describe, expect, it } from 'vitest'

import { bestPendingScore, type PendingScore } from './pending-scores'

const TODAY = '2026-08-10'

const entry = (over: Partial<PendingScore> = {}): PendingScore => ({
  mode: 'speed',
  difficulty: 'hard',
  score: 1000,
  hits: 10,
  day: TODAY,
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

  it('includes days still inside the week', () => {
    const queue = [entry({ day: '2026-08-04', score: 5000 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'week', TODAY)).toBe(5000)
  })

  it('excludes days that fell out of the week', () => {
    const queue = [entry({ day: '2026-08-03', score: 5000 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'week', TODAY)).toBeNull()
  })

  it('keeps old days under all time', () => {
    const queue = [entry({ day: '2019-01-01', score: 5000 })]
    expect(bestPendingScore(queue, 'speed', 'hard', 'forever', TODAY)).toBe(5000)
  })
})
