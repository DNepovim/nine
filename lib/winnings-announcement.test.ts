import { describe, expect, it } from 'vitest'

import type { Award } from '@/lib/winnings'
import { announcementRange, awardBlocks, markerAfter } from '@/lib/winnings-announcement'

// 2026-09-23 is a Wednesday; the week before it runs Mon 14th to Sun 20th.
const TODAY = '2026-09-23'

const award = (over: Partial<Award> = {}): Award => ({
  period: 'day',
  mode: 'speed',
  difficulty: 'extreme',
  wonOn: '2026-09-22',
  score: 1000,
  ...over,
})

describe('announcementRange', () => {
  it('has nothing to say when the marker is already yesterday', () => {
    expect(announcementRange('2026-09-22', TODAY)).toBeNull()
  })

  it('asks for yesterday alone when the marker is the day before it', () => {
    expect(announcementRange('2026-09-21', TODAY)).toEqual({
      from: '2026-09-22',
      to: '2026-09-22',
    })
  })

  it('starts the day after the marker, never on it', () => {
    const range = announcementRange('2026-09-19', TODAY)
    expect(range?.from).toBe('2026-09-20')
  })

  it('never reaches today, whose window has not closed', () => {
    expect(announcementRange('2026-09-01', TODAY)?.to).toBe('2026-09-22')
  })

  it('covers a long absence in one span', () => {
    expect(announcementRange('2026-08-31', TODAY)).toEqual({
      from: '2026-09-01',
      to: '2026-09-22',
    })
  })

  it('says nothing when the marker is somehow ahead of today', () => {
    expect(announcementRange('2026-09-30', TODAY)).toBeNull()
  })

  it('steps across a month boundary', () => {
    expect(announcementRange('2026-08-30', '2026-09-01')).toEqual({
      from: '2026-08-31',
      to: '2026-08-31',
    })
  })
})

describe('markerAfter', () => {
  it('stores yesterday, so today is still announced once it closes', () => {
    expect(markerAfter(TODAY)).toBe('2026-09-22')
  })

  it('leaves a first launch with nothing to catch up on', () => {
    expect(announcementRange(markerAfter(TODAY), TODAY)).toBeNull()
  })

  it('round-trips: announcing then storing leaves nothing to repeat', () => {
    const stored = markerAfter(TODAY)
    expect(announcementRange(stored, TODAY)).toBeNull()
  })
})

describe('awardBlocks', () => {
  it('returns nothing for a player who won nothing', () => {
    expect(awardBlocks([])).toEqual([])
  })

  it('groups awards of the same window under one block', () => {
    const blocks = awardBlocks([
      award({ difficulty: 'hard' }),
      award({ difficulty: 'extreme' }),
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.awards).toHaveLength(2)
  })

  it('splits a day and a week into separate blocks', () => {
    const blocks = awardBlocks([award(), award({ period: 'week', wonOn: '2026-09-14' })])
    expect(blocks.map((b) => b.period)).toEqual(['day', 'week'])
  })

  it('puts the most recent window first', () => {
    const blocks = awardBlocks([
      award({ wonOn: '2026-09-18' }),
      award({ wonOn: '2026-09-22' }),
      award({ wonOn: '2026-09-20' }),
    ])
    expect(blocks.map((b) => b.wonOn)).toEqual(['2026-09-22', '2026-09-20', '2026-09-18'])
  })

  it('puts the biggest award first inside a block', () => {
    const blocks = awardBlocks([
      award({ difficulty: 'easy', score: 1000 }),
      award({ difficulty: 'extreme', score: 1000 }),
      award({ difficulty: 'hard', score: 1000 }),
    ])
    expect(blocks[0]?.awards.map((a) => a.difficulty)).toEqual([
      'extreme',
      'hard',
      'easy',
    ])
  })

  it('breaks an equal-award tie on the app’s own board order', () => {
    const blocks = awardBlocks([
      award({ mode: 'speed', difficulty: 'hard', score: 1000 }),
      award({ mode: 'accuracy', difficulty: 'hard', score: 1000 }),
    ])
    expect(blocks[0]?.awards.map((a) => a.mode)).toEqual(['accuracy', 'speed'])
  })
})
