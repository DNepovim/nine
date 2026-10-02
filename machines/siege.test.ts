import { describe, expect, it } from 'vitest'

import {
  SIEGE_PAR_MAX,
  SIEGE_PAR_MIN,
  TOWER_HITS_DEEP,
  TOWER_HITS_SHALLOW,
  TOWERS_DEEP,
  TOWERS_SHALLOW,
} from '@/constants/siege'
import { parTable } from '@/machines/scoring'
import { NINE_DIAL, type Grid } from '@/modes'

import { land, liveValues, newSiege, towerCount, towerHits } from './siege'

const zeros: Grid = [0, 0, 0, 0, 0, 0, 0, 0, 0]
const busy: Grid = [3, 7, 1, 9, 2, 4, 0, 6, 8]

describe('towerCount and towerHits', () => {
  it('start shallow and end deep', () => {
    expect(towerCount(0)).toBe(TOWERS_SHALLOW)
    expect(towerCount(100)).toBe(TOWERS_DEEP)
    expect(towerHits(0)).toBe(TOWER_HITS_SHALLOW)
    expect(towerHits(100)).toBe(TOWER_HITS_DEEP)
  })

  it('never go backwards as the run climbs', () => {
    for (let depth = 1; depth <= 60; depth++) {
      expect(towerCount(depth)).toBeGreaterThanOrEqual(towerCount(depth - 1))
      expect(towerHits(depth)).toBeGreaterThanOrEqual(towerHits(depth - 1))
    }
  })
})

describe('newSiege', () => {
  it('builds the walls the depth asks for', () => {
    const siege = newSiege('1.0', 0, 42, zeros, 1000)
    expect(siege.towers).toHaveLength(TOWERS_SHALLOW)
    for (const tower of siege.towers) {
      expect(tower.left).toBe(TOWER_HITS_SHALLOW)
      expect(tower.hits).toBe(TOWER_HITS_SHALLOW)
    }
    expect(siege.warriors).toEqual([])
    expect(siege.spawned).toBe(0)
  })

  it('gives every tower a number of its own, inside the siege band', () => {
    const siege = newSiege('2', 40, 7, busy, 0)
    const table = parTable(NINE_DIAL, busy)
    expect(new Set(siege.towers.map((t) => t.value)).size).toBe(siege.towers.length)
    for (const tower of siege.towers) {
      expect(table[tower.value]).toBeGreaterThanOrEqual(SIEGE_PAR_MIN)
      // The band stretches when it has to, so this is the ask rather than the promise.
      expect(table[tower.value]).toBeLessThanOrEqual(SIEGE_PAR_MAX + 12)
    }
  })

  it('fills a deep siege even from an untouched grid', () => {
    const siege = newSiege('3', 100, 1, zeros, 0)
    expect(siege.towers).toHaveLength(TOWERS_DEEP)
    expect(new Set(siege.towers.map((t) => t.value)).size).toBe(TOWERS_DEEP)
  })

  it('is the same siege for the same seed and crossroad', () => {
    const a = newSiege('1.2', 9, 300, busy, 0)
    const b = newSiege('1.2', 9, 300, busy, 0)
    expect(a).toEqual(b)
  })

  it('is a different siege at a different crossroad', () => {
    const a = newSiege('1.2', 9, 300, busy, 0)
    const b = newSiege('1.3', 9, 300, busy, 0)
    expect(a.towers.map((t) => t.value)).not.toEqual(b.towers.map((t) => t.value))
  })

  it('counts only standing towers as live', () => {
    const siege = newSiege('1', 0, 5, zeros, 0)
    const flattened = {
      ...siege,
      towers: siege.towers.map((t, i) => (i === 0 ? { ...t, left: 0 } : t)),
    }
    expect(liveValues(flattened)).toHaveLength(siege.towers.length - 1)
    expect(liveValues(flattened)).not.toContain(siege.towers[0]?.value)
  })
})

describe('land', () => {
  const siege = newSiege('1', 0, 42, zeros, 0)
  const first = siege.towers[0]
  if (first === undefined) throw new Error('a siege with no towers')

  it('chips the tower whose number was arrived at', () => {
    const hit = land(siege, 0, first.value)
    expect(hit.tower?.id).toBe(first.id)
    expect(hit.tower?.left).toBe(first.left - 1)
    expect(hit.siege.towers[0]?.left).toBe(first.left - 1)
    expect(hit.warrior).toBeNull()
    expect(hit.taken).toBe(false)
  })

  it('resolves nothing when the sum did not move', () => {
    const hit = land(siege, first.value, first.value)
    expect(hit.tower).toBeNull()
    expect(hit.warrior).toBeNull()
    expect(hit.siege).toBe(siege)
  })

  it('resolves nothing on a number no one answers to', () => {
    const live = new Set(liveValues(siege))
    const quiet = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const hit = land(siege, 0, quiet)
    expect(hit.tower).toBeNull()
    expect(hit.warrior).toBeNull()
  })

  it('leaves rubble alone', () => {
    const flat = {
      ...siege,
      towers: siege.towers.map((t) => (t.id === first.id ? { ...t, left: 0 } : t)),
    }
    const hit = land(flat, 0, first.value)
    expect(hit.tower).toBeNull()
    expect(hit.siege.towers[0]?.left).toBe(0)
  })

  it('calls the village taken on the hit that flattens the last tower', () => {
    const nearly = {
      ...siege,
      towers: siege.towers.map((t, i) => ({ ...t, left: i === 0 ? 1 : 0 })),
    }
    const hit = land(nearly, 0, first.value)
    expect(hit.taken).toBe(true)
  })

  it('kills the warrior whose number was arrived at', () => {
    const live = new Set(liveValues(siege))
    const free = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const withWarrior = {
      ...siege,
      warriors: [{ id: 'w0', value: free, spawnedAt: 0, walkMs: 5000, lane: 0 }],
    }
    const hit = land(withWarrior, 0, free)
    expect(hit.warrior?.id).toBe('w0')
    expect(hit.siege.warriors).toEqual([])
    expect(hit.tower).toBeNull()
  })
})
