import { describe, expect, it } from 'vitest'

import { mergeEarned, type AchievementStore } from '@/lib/achievement-store'
import { awardsOf, earned, type AchievementFacts } from '@/lib/achievements'
import { emptyCareer } from '@/lib/career'
import { emptyStats } from '@/machines/game'
import type { Difficulty, Mode } from '@/machines/modes'

// A run that landed hits on one board, with everything else blank. Enough for the two
// rules this file is about, both of which only read the run.
const factsFor = (
  mode: Mode,
  difficulty: Difficulty,
  hits: number,
): AchievementFacts => ({
  career: emptyCareer(),
  stats: emptyStats(),
  run: {
    mode,
    difficulty,
    score: 100,
    hits,
    maxStreak: 0,
    cleanHits: 0,
    parHits: 0,
    longestRoute: 0,
    elapsedMs: 1000,
    avgAccuracy: 0,
    avgSpeed: 0,
    personalBest: false,
    finished: true,
    endedAt: new Date('2026-09-22T12:00:00Z'),
  },
  standings: [],
  crown: false,
  crossed: [],
  guideRead: true,
  now: new Date('2026-09-22T12:00:00Z'),
})

const keysEarned = (facts: AchievementFacts): string[] =>
  earned(facts).map((a) => (a.stage === null ? a.id : `${a.id}:${a.stage}`))

describe('a mode-staged achievement', () => {
  it('has one stage per scored mode', () => {
    expect(awardsOf('intoTheDeep')).toEqual([
      { id: 'intoTheDeep', stage: 'accuracy' },
      { id: 'intoTheDeep', stage: 'speed' },
    ])
  })

  it('is cleared only on the mode the run was played in', () => {
    const keys = keysEarned(factsFor('accuracy', 'extreme', 1))
    expect(keys).toContain('intoTheDeep:accuracy')
    expect(keys).not.toContain('intoTheDeep:speed')
  })

  it('still asks for Extreme — an easier board clears neither mode', () => {
    const keys = keysEarned(factsFor('accuracy', 'hard', 10))
    expect(keys).not.toContain('intoTheDeep:accuracy')
    expect(keys).not.toContain('intoTheDeep:speed')
  })

  it('needs a hit, not just a visit', () => {
    const keys = keysEarned(factsFor('speed', 'extreme', 0))
    expect(keys).not.toContain('intoTheDeep:speed')
  })
})

describe('a difficulty-staged achievement', () => {
  it('still has one stage per difficulty', () => {
    expect(awardsOf('steadyHand')).toEqual([
      { id: 'steadyHand', stage: 'easy' },
      { id: 'steadyHand', stage: 'hard' },
      { id: 'steadyHand', stage: 'extreme' },
    ])
  })
})

describe('an award stored before its achievement was staged', () => {
  it('is grandfathered onto every stage, because nothing is ever taken back', () => {
    const old: AchievementStore = [
      { id: 'intoTheDeep', stage: null, earnedAt: '2026-01-01T00:00:00Z', synced: true },
    ]
    expect(mergeEarned(old, [])).toEqual([
      {
        id: 'intoTheDeep',
        stage: 'accuracy',
        earnedAt: '2026-01-01T00:00:00Z',
        synced: false,
      },
      {
        id: 'intoTheDeep',
        stage: 'speed',
        earnedAt: '2026-01-01T00:00:00Z',
        synced: false,
      },
    ])
  })

  it('keeps the moment it was originally earned', () => {
    const old: AchievementStore = [
      { id: 'intoTheDeep', stage: null, earnedAt: '2025-06-30T08:00:00Z', synced: true },
    ]
    expect(mergeEarned(old, []).map((e) => e.earnedAt)).toEqual([
      '2025-06-30T08:00:00Z',
      '2025-06-30T08:00:00Z',
    ])
  })
})
