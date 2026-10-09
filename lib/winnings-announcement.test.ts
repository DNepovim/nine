import { describe, expect, it } from 'vitest'

import type { Award } from '@/lib/winnings'
import { askedToday, awardBlocks } from '@/lib/winnings-announcement'

// 2026-09-23 is a Wednesday; the week before it runs Mon 14th to Sun 20th.
const TODAY = '2026-09-23'

const award = (over: Partial<Award> = {}): Award => ({
  period: 'day',
  mode: 'speed',
  difficulty: 'extreme',
  wonOn: '2026-09-22',
  score: 1000,
  rank: 1,
  ...over,
})

describe('askedToday', () => {
  it('holds the launch back once the server has answered today', () => {
    expect(askedToday(TODAY, TODAY)).toBe(true)
  })

  it('opens the question again on the first launch of a new day', () => {
    expect(askedToday('2026-09-22', TODAY)).toBe(false)
  })

  // The old marker started a wiped device at yesterday and forfeited whatever was behind
  // it. Nothing stored now means the question has never been asked, so it gets asked.
  it('asks on a device that has never asked', () => {
    expect(askedToday(null, TODAY)).toBe(false)
  })

  it('asks again when the stored day is somehow ahead of today', () => {
    expect(askedToday('2026-09-30', TODAY)).toBe(false)
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

  // One block is one step of the podium, which is what lets a sentence open with "you
  // took" or "you came second" and then list boards without qualifying any of them.
  it('splits one day’s podium steps into separate blocks', () => {
    const blocks = awardBlocks([
      award({ rank: 2, mode: 'accuracy' }),
      award({ rank: 1, mode: 'speed' }),
    ])
    expect(blocks).toHaveLength(2)
    expect(
      blocks.every((block) => block.awards.every((a) => a.rank === block.rank)),
    ).toBe(true)
  })

  it('reads a day gold before its silver before its bronze', () => {
    const blocks = awardBlocks([
      award({ rank: 3 }),
      award({ rank: 1 }),
      award({ rank: 2 }),
    ])
    expect(blocks.map((b) => b.rank)).toEqual([1, 2, 3])
  })

  it('still puts a whole newer window ahead of an older one’s gold', () => {
    const blocks = awardBlocks([
      award({ wonOn: '2026-09-20', rank: 1 }),
      award({ wonOn: '2026-09-22', rank: 3 }),
    ])
    expect(blocks.map((b) => b.wonOn)).toEqual(['2026-09-22', '2026-09-20'])
  })

  it('orders a day’s steps before a week’s on the same date', () => {
    const blocks = awardBlocks([
      award({ period: 'week', wonOn: '2026-09-21', rank: 1 }),
      award({ period: 'day', wonOn: '2026-09-21', rank: 2 }),
    ])
    expect(blocks.map((b) => b.period)).toEqual(['day', 'week'])
  })
})
