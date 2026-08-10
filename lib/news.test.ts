import { describe, expect, it } from 'vitest'

import type { Release } from '@/types/news'

import {
  allItems,
  catchUpItems,
  parseSeenIds,
  serializeSeenIds,
  unseenItems,
  unseenReleases,
} from './news'

const item = (id: string) => ({
  id,
  icon: 'sparkles' as const,
  accent: '#4C7EFF',
  title: id,
  body: 'body',
})

const RELEASES: Release[] = [
  { date: '2026-08-10', items: [item('b'), item('c')] },
  { date: '2026-08-01', items: [item('a')] },
]

describe('allItems', () => {
  it('flattens releases in order', () => {
    expect(allItems(RELEASES).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('parseSeenIds', () => {
  it('distinguishes no record from an empty record', () => {
    expect(parseSeenIds(null)).toBeNull()
    expect(parseSeenIds('[]')).toEqual([])
  })

  it('reads a stored list', () => {
    expect(parseSeenIds('["a","b"]')).toEqual(['a', 'b'])
  })

  it('treats malformed JSON as no record', () => {
    expect(parseSeenIds('{oops')).toBeNull()
  })

  it('treats a wrong shape as no record', () => {
    expect(parseSeenIds('{"seen":["a"]}')).toBeNull()
    expect(parseSeenIds('[1,2]')).toBeNull()
  })

  it('round-trips', () => {
    expect(parseSeenIds(serializeSeenIds(['a', 'b']))).toEqual(['a', 'b'])
  })
})

describe('unseenItems', () => {
  it('returns everything when nothing is seen', () => {
    expect(unseenItems(RELEASES, []).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('filters out seen ids', () => {
    expect(unseenItems(RELEASES, ['b', 'a']).map((i) => i.id)).toEqual(['c'])
  })

  it('returns nothing when all are seen', () => {
    expect(unseenItems(RELEASES, ['a', 'b', 'c'])).toEqual([])
  })

  it('ignores ids that no longer exist', () => {
    expect(unseenItems(RELEASES, ['gone']).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('catchUpItems', () => {
  it('walks forward through time, ending on the newest', () => {
    expect(catchUpItems(RELEASES, []).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('shows every missed item, not only the latest release', () => {
    // Someone away long enough to miss two releases sees all three items.
    expect(catchUpItems(RELEASES, [])).toHaveLength(3)
  })

  it('keeps the authored order within a release', () => {
    expect(
      catchUpItems([{ date: '2026-08-10', items: [item('x'), item('y')] }], []).map(
        (i) => i.id,
      ),
    ).toEqual(['x', 'y'])
  })

  it('skips what has already been seen', () => {
    expect(catchUpItems(RELEASES, ['a']).map((i) => i.id)).toEqual(['b', 'c'])
  })

  it('orders by date even when entries are authored out of sequence', () => {
    const jumbled: Release[] = [
      { date: '2026-08-05', items: [item('middle')] },
      { date: '2026-08-09', items: [item('newest')] },
      { date: '2026-08-01', items: [item('oldest')] },
    ]
    expect(catchUpItems(jumbled, []).map((i) => i.id)).toEqual([
      'oldest',
      'middle',
      'newest',
    ])
  })

  it('leaves the caller’s array untouched', () => {
    const input: Release[] = [...RELEASES]
    catchUpItems(input, [])
    expect(input.map((r) => r.date)).toEqual(['2026-08-10', '2026-08-01'])
  })
})

describe('unseenReleases', () => {
  it('drops releases whose items are all seen', () => {
    const result = unseenReleases(RELEASES, ['b', 'c'])
    expect(result.map((r) => r.date)).toEqual(['2026-08-01'])
  })

  it('keeps a release but strips its seen items', () => {
    const result = unseenReleases(RELEASES, ['b'])
    expect(result[0]?.items.map((i) => i.id)).toEqual(['c'])
  })

  it('returns nothing when everything is seen', () => {
    expect(unseenReleases(RELEASES, ['a', 'b', 'c'])).toEqual([])
  })
})
