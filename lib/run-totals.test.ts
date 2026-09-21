import { describe, expect, it } from 'vitest'

import { dropRun, pruneRunTotals, queueRun, type PendingRun } from './run-totals'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-21T12:00:00.000Z')

const run = (runId: string, endedAt = '2026-09-21T11:00:00.000Z'): PendingRun => ({
  runId,
  mode: 'accuracy',
  difficulty: 'hard',
  score: 1200,
  hits: 14,
  accSum: 11.2,
  spdSum: 6.4,
  endedAt,
})

const agoDays = (days: number): string => new Date(NOW - days * DAY).toISOString()

describe('queueRun', () => {
  it('keeps every run, including one that beat nothing', () => {
    const store = queueRun(queueRun([], run('a')), { ...run('b'), score: 0, hits: 0 })
    expect(store.map((entry) => entry.runId)).toEqual(['a', 'b'])
  })
})

describe('dropRun', () => {
  it('removes the run that landed and leaves the rest', () => {
    const store = [run('a'), run('b'), run('c')]
    expect(dropRun(store, 'b').map((entry) => entry.runId)).toEqual(['a', 'c'])
  })

  it('leaves the store alone when the id is not in it', () => {
    const store = [run('a')]
    expect(dropRun(store, 'gone')).toEqual(store)
  })
})

describe('pruneRunTotals', () => {
  it('keeps everything inside the bounds', () => {
    const store = [run('a', agoDays(1)), run('b', agoDays(29))]
    expect(pruneRunTotals(store, NOW)).toEqual(store)
  })

  it('drops runs past the age bound', () => {
    const store = [run('fresh', agoDays(2)), run('stale', agoDays(31))]
    expect(pruneRunTotals(store, NOW).map((entry) => entry.runId)).toEqual(['fresh'])
  })

  it('keeps the newest runs past the count bound', () => {
    const store = Array.from({ length: 205 }, (_, index) =>
      run(`run-${index}`, agoDays(index / 10)),
    )
    const pruned = pruneRunTotals(store, NOW)
    expect(pruned).toHaveLength(200)
    expect(pruned[0]?.runId).toBe('run-0')
    expect(pruned.some((entry) => entry.runId === 'run-204')).toBe(false)
  })
})
