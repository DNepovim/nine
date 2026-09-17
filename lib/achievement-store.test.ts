import { describe, expect, it } from 'vitest'

import {
  addEarned,
  EMPTY_STORE,
  idsOf,
  markSynced,
  mergeEarned,
  unsyncedOf,
  type AchievementStore,
} from './achievement-store'

const entry = (
  id: 'firstHit' | 'graduate' | 'tenRuns',
  earnedAt: string,
  synced = false,
) => ({ id, earnedAt, synced }) as const

describe('mergeEarned', () => {
  it('takes the union of both sides', () => {
    const local: AchievementStore = [entry('firstHit', '2026-09-01T00:00:00.000Z')]
    const remote: AchievementStore = [entry('tenRuns', '2026-09-02T00:00:00.000Z', true)]
    expect(idsOf(mergeEarned(local, remote))).toEqual(['firstHit', 'tenRuns'])
  })

  it('keeps the earlier moment for something both sides hold', () => {
    const local: AchievementStore = [entry('firstHit', '2026-09-05T00:00:00.000Z')]
    const remote: AchievementStore = [entry('firstHit', '2026-09-01T00:00:00.000Z', true)]
    expect(mergeEarned(local, remote)[0]?.earnedAt).toBe('2026-09-01T00:00:00.000Z')
  })

  it('treats it as synced once either side says it is', () => {
    const local: AchievementStore = [entry('firstHit', '2026-09-05T00:00:00.000Z', false)]
    const remote: AchievementStore = [entry('firstHit', '2026-09-01T00:00:00.000Z', true)]
    expect(mergeEarned(local, remote)[0]?.synced).toBe(true)
  })

  it('returns catalogue order however the two sides were ordered', () => {
    const local: AchievementStore = [entry('tenRuns', '2026-09-01T00:00:00.000Z')]
    const remote: AchievementStore = [entry('firstHit', '2026-09-02T00:00:00.000Z', true)]
    expect(idsOf(mergeEarned(local, remote))).toEqual(['firstHit', 'tenRuns'])
  })

  it('leaves a store alone when the other side is empty', () => {
    const local: AchievementStore = [entry('firstHit', '2026-09-01T00:00:00.000Z')]
    expect(mergeEarned(local, EMPTY_STORE)).toEqual(local)
  })
})

describe('addEarned', () => {
  it('adds something new, unsynced', () => {
    const next = addEarned(EMPTY_STORE, ['firstHit'], '2026-09-17T00:00:00.000Z')
    expect(next).toEqual([entry('firstHit', '2026-09-17T00:00:00.000Z', false)])
  })

  it('leaves the moment an achievement was first earned alone', () => {
    const held = addEarned(EMPTY_STORE, ['firstHit'], '2026-09-01T00:00:00.000Z')
    const again = addEarned(held, ['firstHit'], '2026-09-17T00:00:00.000Z')
    expect(again[0]?.earnedAt).toBe('2026-09-01T00:00:00.000Z')
  })

  it('hands back the same store when nothing is new', () => {
    const held = addEarned(EMPTY_STORE, ['firstHit'], '2026-09-01T00:00:00.000Z')
    expect(addEarned(held, ['firstHit'], '2026-09-17T00:00:00.000Z')).toBe(held)
  })
})

describe('the sync queue', () => {
  it('lists only what the server has not been told about', () => {
    const store: AchievementStore = [
      entry('firstHit', '2026-09-01T00:00:00.000Z', true),
      entry('tenRuns', '2026-09-02T00:00:00.000Z', false),
    ]
    expect(idsOf(unsyncedOf(store))).toEqual(['tenRuns'])
  })

  it('empties once the push lands', () => {
    const store: AchievementStore = [entry('tenRuns', '2026-09-02T00:00:00.000Z', false)]
    expect(unsyncedOf(markSynced(store))).toEqual([])
  })
})
