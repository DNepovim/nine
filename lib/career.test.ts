import { describe, expect, it } from 'vitest'

import {
  ALL_BOARDS,
  boardKey,
  emptyCareer,
  foldMultiplayer,
  foldRun,
  heldDays,
  observeHeld,
  type Career,
  type RunSummary,
} from './career'

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: 'accuracy',
  difficulty: 'easy',
  score: 400,
  hits: 12,
  strikes: 5,
  maxStreak: 3,
  cleanHits: 8,
  elapsedMs: 60_000,
  day: '2026-09-17',
  personalBest: false,
  ...over,
})

const career = (over: Partial<Career> = {}): Career => ({ ...emptyCareer(), ...over })

describe('ALL_BOARDS', () => {
  it('covers every scored mode and difficulty, and no others', () => {
    expect(ALL_BOARDS).toHaveLength(6)
    expect(ALL_BOARDS).toContain('accuracy:extreme')
    expect(ALL_BOARDS).toContain('speed:easy')
    expect(ALL_BOARDS.some((key) => key.startsWith('trainee'))).toBe(false)
  })
})

describe('foldRun', () => {
  it('adds the run to every lifetime total', () => {
    const next = foldRun(emptyCareer(), run())
    expect(next.runs).toBe(1)
    expect(next.hits).toBe(12)
    expect(next.points).toBe(400)
    expect(next.strikes).toBe(5)
  })

  it('keeps the highest streak rather than the latest', () => {
    const next = foldRun(career({ bestStreak: 7 }), run({ maxStreak: 3 }))
    expect(next.bestStreak).toBe(7)
  })

  it('keeps the longest clean stretch rather than the latest', () => {
    const next = foldRun(career({ bestCleanHits: 30 }), run({ cleanHits: 8 }))
    expect(next.bestCleanHits).toBe(30)
  })

  it('counts a personal best only when the run set one', () => {
    expect(foldRun(emptyCareer(), run({ personalBest: true })).personalBests).toBe(1)
    expect(foldRun(emptyCareer(), run({ personalBest: false })).personalBests).toBe(0)
  })

  it('records the board a scoring run was played on', () => {
    const next = foldRun(emptyCareer(), run({ mode: 'speed', difficulty: 'extreme' }))
    expect(next.boardsPlayed).toEqual(['speed:extreme'])
  })

  it('records a board once however many runs land on it', () => {
    const next = foldRun(foldRun(emptyCareer(), run()), run())
    expect(next.boardsPlayed).toEqual([boardKey('accuracy', 'easy')])
  })

  it('records no board for trainee, which keeps none', () => {
    expect(foldRun(emptyCareer(), run({ mode: 'trainee' })).boardsPlayed).toEqual([])
  })

  it('records no board for a run that scored nothing', () => {
    expect(foldRun(emptyCareer(), run({ score: 0 })).boardsPlayed).toEqual([])
  })

  it('records the mode even for a run that scored nothing', () => {
    const next = foldRun(emptyCareer(), run({ mode: 'trainee', score: 0 }))
    expect(next.modesPlayed).toEqual(['trainee'])
  })

  it('records a difficulty only for a scored mode', () => {
    const practice = foldRun(
      emptyCareer(),
      run({ mode: 'trainee', difficulty: 'extreme' }),
    )
    expect(practice.difficultiesPlayed).toEqual([])
    expect(foldRun(practice, run({ difficulty: 'hard' })).difficultiesPlayed).toEqual([
      'hard',
    ])
  })

  it('starts the day streak at one on the first ever run', () => {
    const next = foldRun(emptyCareer(), run({ day: '2026-09-17' }))
    expect(next.dayStreak).toBe(1)
    expect(next.lastDay).toBe('2026-09-17')
  })

  it('leaves the day streak alone for a second run the same day', () => {
    const first = foldRun(emptyCareer(), run({ day: '2026-09-17' }))
    expect(foldRun(first, run({ day: '2026-09-17' })).dayStreak).toBe(1)
  })

  it('extends the day streak on the very next day', () => {
    const first = foldRun(emptyCareer(), run({ day: '2026-09-17' }))
    expect(foldRun(first, run({ day: '2026-09-18' })).dayStreak).toBe(2)
  })

  it('extends the day streak across a month boundary', () => {
    const first = foldRun(emptyCareer(), run({ day: '2026-09-30' }))
    expect(foldRun(first, run({ day: '2026-10-01' })).dayStreak).toBe(2)
  })

  it('restarts the day streak after a gap', () => {
    const first = foldRun(emptyCareer(), run({ day: '2026-09-17' }))
    expect(foldRun(first, run({ day: '2026-09-19' })).dayStreak).toBe(1)
  })

  it('remembers the longest day streak after one breaks', () => {
    const grown = career({ lastDay: '2026-09-17', dayStreak: 5, bestDayStreak: 5 })
    const next = foldRun(grown, run({ day: '2026-09-20' }))
    expect(next.dayStreak).toBe(1)
    expect(next.bestDayStreak).toBe(5)
  })

  it('never drags the last day backwards', () => {
    const grown = career({ lastDay: '2026-09-17', dayStreak: 3, bestDayStreak: 3 })
    const next = foldRun(grown, run({ day: '2026-09-10' }))
    expect(next.lastDay).toBe('2026-09-17')
  })

  it('keeps the longest run rather than the latest', () => {
    const next = foldRun(career({ longestRunMs: 500_000 }), run({ elapsedMs: 60_000 }))
    expect(next.longestRunMs).toBe(500_000)
  })
})

describe('foldMultiplayer', () => {
  it('counts a shared run, and a win only when it was one', () => {
    const played = foldMultiplayer(emptyCareer(), { won: false, players: 2 })
    expect(played.multiplayerRuns).toBe(1)
    expect(played.multiplayerWins).toBe(0)
    expect(foldMultiplayer(played, { won: true, players: 2 }).multiplayerWins).toBe(1)
  })

  it('keeps the biggest room ever played, not the latest', () => {
    const big = foldMultiplayer(emptyCareer(), { won: false, players: 4 })
    expect(foldMultiplayer(big, { won: false, players: 2 }).biggestRoom).toBe(4)
  })
})

describe('observeHeld', () => {
  it('stamps a board the first time it is seen held', () => {
    const next = observeHeld(emptyCareer(), ['accuracy:easy'], '2026-09-17T10:00:00.000Z')
    expect(next.heldSince['accuracy:easy']).toBe('2026-09-17T10:00:00.000Z')
  })

  it('keeps the original moment while the board is still held', () => {
    const first = observeHeld(
      emptyCareer(),
      ['accuracy:easy'],
      '2026-09-10T10:00:00.000Z',
    )
    const later = observeHeld(first, ['accuracy:easy'], '2026-09-17T10:00:00.000Z')
    expect(later.heldSince['accuracy:easy']).toBe('2026-09-10T10:00:00.000Z')
  })

  it('drops a board that is no longer held', () => {
    const first = observeHeld(
      emptyCareer(),
      ['accuracy:easy'],
      '2026-09-10T10:00:00.000Z',
    )
    expect(observeHeld(first, [], '2026-09-17T10:00:00.000Z').heldSince).toEqual({})
  })

  it('restarts the clock when a lost board is retaken', () => {
    const first = observeHeld(
      emptyCareer(),
      ['accuracy:easy'],
      '2026-09-10T10:00:00.000Z',
    )
    const lost = observeHeld(first, [], '2026-09-12T10:00:00.000Z')
    const retaken = observeHeld(lost, ['accuracy:easy'], '2026-09-17T10:00:00.000Z')
    expect(retaken.heldSince['accuracy:easy']).toBe('2026-09-17T10:00:00.000Z')
  })
})

describe('heldDays', () => {
  it('counts whole days since the board was taken', () => {
    const held = observeHeld(emptyCareer(), ['speed:hard'], '2026-09-10T10:00:00.000Z')
    expect(heldDays(held, 'speed:hard', new Date('2026-09-17T11:00:00.000Z'))).toBe(7)
  })

  it('rounds down, so six and a half days is not seven', () => {
    const held = observeHeld(emptyCareer(), ['speed:hard'], '2026-09-10T10:00:00.000Z')
    expect(heldDays(held, 'speed:hard', new Date('2026-09-16T22:00:00.000Z'))).toBe(6)
  })

  it('answers zero for a board that is not held', () => {
    expect(heldDays(emptyCareer(), 'speed:hard', new Date())).toBe(0)
  })
})
