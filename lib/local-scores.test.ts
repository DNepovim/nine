import { describe, expect, it } from 'vitest'

import {
  bestFor,
  bestPending,
  markPublished,
  MAX_PUBLISH_ATTEMPTS,
  noteRefusal,
  pendingOf,
  pruneLocalScores,
  recordRun,
  type LocalScore,
} from './local-scores'

// A Wednesday, so its Monday-to-Sunday week has days either side of it.
const TODAY = '2026-08-12'

const run = (over: Partial<LocalScore> = {}) => ({
  mode: 'speed' as const,
  difficulty: 'hard' as const,
  day: TODAY,
  score: 1000,
  hits: 10,
  achievedAt: `${TODAY}T10:00:00.000Z`,
  ...over,
})

const entry = (over: Partial<LocalScore> = {}): LocalScore => ({
  ...run(),
  status: 'pending',
  attempts: 0,
  ...over,
})

const slot = { mode: 'speed' as const, difficulty: 'hard' as const, day: TODAY }

describe('recordRun', () => {
  it('records a run on an empty store, waiting to publish', () => {
    expect(recordRun([], run({ score: 700 }))).toEqual([
      entry({ score: 700, status: 'pending', attempts: 0 }),
    ])
  })

  it('keeps the higher score for the same board and day', () => {
    const store = recordRun([entry({ score: 700 })], run({ score: 900 }))
    expect(store).toEqual([entry({ score: 900 })])
  })

  it('returns the store unchanged when the run beats nothing', () => {
    const store = [entry({ score: 900 })]
    expect(recordRun(store, run({ score: 400 }))).toBe(store)
  })

  it('returns the store unchanged when the run only equals the best', () => {
    const store = [entry({ score: 900 })]
    expect(recordRun(store, run({ score: 900 }))).toBe(store)
  })

  it('reopens a published slot when the run beats it', () => {
    // The server holds the old number and has not been told about this one.
    const store = recordRun(
      [entry({ score: 700, status: 'published' })],
      run({ score: 900 }),
    )
    expect(store).toEqual([entry({ score: 900, status: 'pending' })])
  })

  it('keeps another day on the same board separate', () => {
    const store = recordRun(
      [entry({ day: '2026-08-11', score: 500 })],
      run({ score: 800 }),
    )
    expect(store).toHaveLength(2)
  })

  it('keeps the same day on another board separate', () => {
    const store = recordRun([entry({ score: 900 })], run({ difficulty: 'easy' }))
    expect(store).toHaveLength(2)
  })
})

describe('pendingOf', () => {
  it('is the publish queue', () => {
    const store = [
      entry({ score: 900 }),
      entry({ day: '2026-08-11', score: 800, status: 'published' }),
      entry({ day: '2026-08-10', score: 700, status: 'rejected' }),
    ]
    expect(pendingOf(store)).toEqual([entry({ score: 900 })])
  })

  it('drops an entry once it publishes', () => {
    const store = markPublished([entry()], slot)
    expect(pendingOf(store)).toEqual([])
  })

  it('leaves other slots alone when one publishes', () => {
    const store = markPublished([entry(), entry({ difficulty: 'easy' })], slot)
    expect(pendingOf(store)).toEqual([entry({ difficulty: 'easy' })])
  })
})

describe('noteRefusal', () => {
  it('counts a refusal without giving up straight away', () => {
    const store = noteRefusal([entry()], slot)
    expect(store).toEqual([entry({ attempts: 1, status: 'pending' })])
    expect(pendingOf(store)).toHaveLength(1)
  })

  it('gives up once the server has refused enough times', () => {
    let store = [entry()]
    for (let i = 0; i < MAX_PUBLISH_ATTEMPTS; i++) store = noteRefusal(store, slot)
    expect(store[0]?.status).toBe('rejected')
    // The point of giving up: it stops being retried forever.
    expect(pendingOf(store)).toEqual([])
  })
})

describe('bestFor', () => {
  it('returns null when the device has nothing on the board', () => {
    expect(bestFor([], 'speed', 'hard', 'today', TODAY)).toBeNull()
  })

  it('takes only today for the today period', () => {
    const store = [entry({ day: '2026-08-11', score: 5000 }), entry({ score: 800 })]
    expect(bestFor(store, 'speed', 'hard', 'today', TODAY)).toBe(800)
  })

  it('takes the whole calendar week for the week period', () => {
    // Monday the 10th is in the week; Sunday the 9th is the week before.
    const store = [
      entry({ day: '2026-08-09', score: 5000 }),
      entry({ day: '2026-08-10', score: 1200 }),
      entry({ score: 800 }),
    ]
    expect(bestFor(store, 'speed', 'hard', 'week', TODAY)).toBe(1200)
  })

  it('counts every status — all of them happened', () => {
    const store = [
      entry({ score: 800 }),
      entry({ day: '2026-08-11', score: 1500, status: 'rejected' }),
      entry({ day: '2026-08-10', score: 1200, status: 'published' }),
    ]
    expect(bestFor(store, 'speed', 'hard', 'forever', TODAY)).toBe(1500)
  })

  it('ignores other boards', () => {
    const store = [
      entry({ mode: 'accuracy', score: 5000 }),
      entry({ difficulty: 'easy', score: 4000 }),
      entry({ score: 800 }),
    ]
    expect(bestFor(store, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })
})

describe('bestPending', () => {
  it('ignores what already published', () => {
    const store = [
      entry({ score: 800 }),
      entry({ day: '2026-08-11', score: 5000, status: 'published' }),
    ]
    expect(bestPending(store, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })

  it('ignores what was refused — it is not on its way anywhere', () => {
    const store = [
      entry({ score: 800 }),
      entry({ day: '2026-08-11', score: 5000, status: 'rejected' }),
    ]
    expect(bestPending(store, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })

  it('is null when nothing is waiting', () => {
    const store = [entry({ status: 'published' })]
    expect(bestPending(store, 'speed', 'hard', 'today', TODAY)).toBeNull()
  })
})

describe('pruneLocalScores', () => {
  it('keeps the last fourteen days, today included', () => {
    const store = [
      entry({ day: '2026-07-30', score: 100 }),
      entry({ day: '2026-07-29', score: 90 }),
      entry({ score: 5000 }),
    ]
    expect(pruneLocalScores(store, TODAY).map((e) => e.day)).toEqual([
      '2026-07-30',
      TODAY,
    ])
  })

  it('keeps an old record that still leads the board, however old', () => {
    // Without this the all-time board would lose the one entry worth publishing.
    const store = [entry({ day: '2025-01-01', score: 9000 }), entry({ score: 100 })]
    expect(pruneLocalScores(store, TODAY)).toHaveLength(2)
  })

  it('keeps one all-time survivor per board', () => {
    const store = [
      entry({ day: '2025-01-01', score: 9000 }),
      entry({ day: '2025-01-02', score: 8000 }),
      entry({ day: '2025-01-03', score: 7000, difficulty: 'easy' }),
    ]
    expect(pruneLocalScores(store, TODAY).map((e) => e.score)).toEqual([9000, 7000])
  })

  it('bounds a store built from a year of daily play', () => {
    const store: LocalScore[] = []
    for (let i = 0; i < 365; i++) {
      const day = new Date(`${TODAY}T00:00:00Z`)
      day.setUTCDate(day.getUTCDate() - i)
      store.push(entry({ day: day.toISOString().slice(0, 10), score: 100 + i }))
    }
    // Fourteen days in the window, plus the single best of all time behind it.
    expect(pruneLocalScores(store, TODAY)).toHaveLength(15)
  })
})
