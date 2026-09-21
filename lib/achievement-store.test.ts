import { describe, expect, it } from 'vitest'

import {
  addEarned,
  EMPTY_STORE,
  firstEarnedAt,
  idsOf,
  latestAchievement,
  markSynced,
  mergeEarned,
  stagesOf,
  unsyncedOf,
  type AchievementStore,
} from './achievement-store'

const entry = (
  id: 'firstHit' | 'graduate' | 'tenRuns',
  earnedAt: string,
  synced = false,
) => ({ id, stage: null, earnedAt, synced }) as const

// A staged award: the same achievement on one board.
const staged = (
  id: 'steadyHand',
  stage: 'easy' | 'hard' | 'extreme',
  earnedAt: string,
  synced = false,
) => ({ id, stage, earnedAt, synced }) as const

describe('restaging', () => {
  it('reads a boardless award for a staged achievement as the Easy stage', () => {
    // Written by a build where UNSCATHED was cleared once. Staging it renamed what the
    // player holds, and an award nobody can name any more is an achievement quietly
    // taken back — so the earliest board it could have been is the one it lands on.
    const legacy: AchievementStore = [
      {
        id: 'unscathed',
        stage: null,
        earnedAt: '2026-08-01T00:00:00.000Z',
        synced: true,
      },
    ]
    const [held, ...rest] = mergeEarned(legacy, EMPTY_STORE)
    expect(rest).toEqual([])
    expect(held?.stage).toBe('easy')
    expect(held?.earnedAt).toBe('2026-08-01T00:00:00.000Z')
    // The server still has it under the old name, so it goes back on the queue.
    expect(held?.synced).toBe(false)
  })

  it('leaves the other boards of a restaged achievement to be cleared', () => {
    const legacy: AchievementStore = [
      {
        id: 'unscathed',
        stage: null,
        earnedAt: '2026-08-01T00:00:00.000Z',
        synced: true,
      },
    ]
    expect(stagesOf(mergeEarned(legacy, EMPTY_STORE), 'unscathed')).toEqual(['easy'])
  })
})

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
    const next = addEarned(
      EMPTY_STORE,
      [{ id: 'firstHit', stage: null }],
      '2026-09-17T00:00:00.000Z',
    )
    expect(next).toEqual([entry('firstHit', '2026-09-17T00:00:00.000Z', false)])
  })

  it('leaves the moment an achievement was first earned alone', () => {
    const held = addEarned(
      EMPTY_STORE,
      [{ id: 'firstHit', stage: null }],
      '2026-09-01T00:00:00.000Z',
    )
    const again = addEarned(
      held,
      [{ id: 'firstHit', stage: null }],
      '2026-09-17T00:00:00.000Z',
    )
    expect(again[0]?.earnedAt).toBe('2026-09-01T00:00:00.000Z')
  })

  it('hands back the same store when nothing is new', () => {
    const held = addEarned(
      EMPTY_STORE,
      [{ id: 'firstHit', stage: null }],
      '2026-09-01T00:00:00.000Z',
    )
    expect(
      addEarned(held, [{ id: 'firstHit', stage: null }], '2026-09-17T00:00:00.000Z'),
    ).toBe(held)
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

describe('latestAchievement', () => {
  it('is nothing on an empty store', () => {
    expect(latestAchievement(EMPTY_STORE)).toBeNull()
  })

  it('takes the most recent, whatever order the store is in', () => {
    const store: AchievementStore = [
      entry('graduate', '2026-09-02T10:00:00.000Z'),
      entry('firstHit', '2026-09-17T10:00:00.000Z'),
      entry('tenRuns', '2026-09-09T10:00:00.000Z'),
    ]
    expect(latestAchievement(store)).toBe('firstHit')
  })

  it('breaks a tie by catalogue order rather than by array position', () => {
    // A run crossing several at once stamps them all with the same instant, so the tie
    // is the common case and has to answer the same way on every device.
    const at = '2026-09-17T10:00:00.000Z'
    const oneWay: AchievementStore = [entry('firstHit', at), entry('graduate', at)]
    const other: AchievementStore = [entry('graduate', at), entry('firstHit', at)]
    expect(latestAchievement(oneWay)).toBe(latestAchievement(other))
    // `graduate` sits after `firstHit` in the catalogue, so it wins.
    expect(latestAchievement(oneWay)).toBe('graduate')
  })
})

describe('a staged achievement in the store', () => {
  const store: AchievementStore = [
    staged('steadyHand', 'easy', '2026-09-01T00:00:00.000Z'),
    staged('steadyHand', 'extreme', '2026-09-17T00:00:00.000Z'),
  ]

  it('counts once however many boards are cleared', () => {
    expect(idsOf(store)).toEqual(['steadyHand'])
  })

  it('names the boards it has been cleared on', () => {
    expect(stagesOf(store, 'steadyHand')).toEqual(['easy', 'extreme'])
    expect(stagesOf(store, 'firstHit')).toEqual([])
  })

  it('dates the row from the first stage, not the latest', () => {
    // The row shows when the achievement first landed; the pips say the rest.
    expect(firstEarnedAt(store, 'steadyHand')).toBe('2026-09-01T00:00:00.000Z')
    expect(firstEarnedAt(store, 'firstHit')).toBeNull()
  })

  it('keeps stages of one achievement apart when adding', () => {
    const added = addEarned(
      store,
      [{ id: 'steadyHand', stage: 'hard' }],
      '2026-09-18T00:00:00.000Z',
    )
    expect(stagesOf(added, 'steadyHand')).toEqual(['easy', 'hard', 'extreme'])
    // Re-adding a board already cleared changes nothing, by identity.
    expect(addEarned(added, [{ id: 'steadyHand', stage: 'hard' }], 'x')).toBe(added)
  })
})
