import { describe, expect, it } from 'vitest'

import {
  SIEGE_PAR_MAX,
  SIEGE_PAR_MIN,
  SPAWN_FIRST_ONE,
  TOWER_HITS_FULL,
  TOWER_HITS_ONE,
  TOWERS_FULL,
  TOWERS_ONE,
  WARRIORS_LIVE_FULL,
  WARRIORS_LIVE_ONE,
} from '@/constants/siege'
import { FIRST_STAGE, STAGE_FULL } from '@/lib/arcade-stage'
import { computePar, parTable } from '@/machines/scoring'
import { NINE_DIAL, type Grid } from '@/modes'

import {
  advance,
  land,
  liveValues,
  newSiege,
  nextEvent,
  opened,
  shift,
  spawnGap,
  spawnWarrior,
  towerCount,
  towerHits,
  warriorsLive,
  warriorWalk,
  type Siege,
} from './siege'

const zeros: Grid = [0, 0, 0, 0, 0, 0, 0, 0, 0]
const busy: Grid = [3, 7, 1, 9, 2, 4, 0, 6, 8]

// A fight some way into an answer that has wandered, which is what a chip takes: a tower
// only comes down whole when the route to it was exactly par, so every test about chipping
// has to be a test about a route that was not.
const scrambled = (siege: Siege): Siege => ({ ...siege, presses: 99 })

describe('towerCount and towerHits', () => {
  it('start at the first stage and end at the last', () => {
    expect(towerCount(FIRST_STAGE)).toBe(TOWERS_ONE)
    expect(towerCount(STAGE_FULL)).toBe(TOWERS_FULL)
    expect(towerHits(FIRST_STAGE)).toBe(TOWER_HITS_ONE)
    expect(towerHits(STAGE_FULL)).toBe(TOWER_HITS_FULL)
  })

  it('never go backwards as the stages climb, and never past the last', () => {
    for (let stage = FIRST_STAGE + 1; stage <= STAGE_FULL + 20; stage++) {
      expect(towerCount(stage)).toBeGreaterThanOrEqual(towerCount(stage - 1))
      expect(towerHits(stage)).toBeGreaterThanOrEqual(towerHits(stage - 1))
      expect(towerCount(stage)).toBeLessThanOrEqual(TOWERS_FULL)
      expect(towerHits(stage)).toBeLessThanOrEqual(TOWER_HITS_FULL)
    }
  })

  it('stands an even number of towers at every stage, so the gate bay stays clear', () => {
    for (let stage = FIRST_STAGE; stage <= STAGE_FULL; stage++) {
      expect(towerCount(stage) % 2).toBe(0)
    }
  })

  it('sends one warrior at a time at the first stage', () => {
    expect(warriorsLive(FIRST_STAGE)).toBe(WARRIORS_LIVE_ONE)
    expect(warriorsLive(STAGE_FULL)).toBe(WARRIORS_LIVE_FULL)
  })
})

describe('newSiege', () => {
  it('builds the walls the stage asks for', () => {
    const siege = newSiege('1.0', FIRST_STAGE, 42, zeros, 1000)
    expect(siege.towers).toHaveLength(TOWERS_ONE)
    for (const tower of siege.towers) {
      expect(tower.left).toBe(TOWER_HITS_ONE)
      expect(tower.hits).toBe(TOWER_HITS_ONE)
    }
    expect(siege.warriors).toEqual([])
    expect(siege.spawned).toBe(0)
  })

  it('gives every tower a number of its own, inside the siege band', () => {
    const siege = newSiege('2', STAGE_FULL, 7, busy, 0)
    const table = parTable(NINE_DIAL, busy)
    expect(new Set(siege.towers.map((t) => t.value)).size).toBe(siege.towers.length)
    for (const tower of siege.towers) {
      expect(table[tower.value]).toBeGreaterThanOrEqual(SIEGE_PAR_MIN)
      // The band stretches when it has to, so this is the ask rather than the promise.
      expect(table[tower.value]).toBeLessThanOrEqual(SIEGE_PAR_MAX + 12)
    }
  })

  it('fills a late siege even from an untouched grid', () => {
    const siege = newSiege('3', STAGE_FULL, 1, zeros, 0)
    expect(siege.towers).toHaveLength(TOWERS_FULL)
    expect(new Set(siege.towers.map((t) => t.value)).size).toBe(TOWERS_FULL)
  })

  it('is the same siege for the same seed and crossroad', () => {
    const a = newSiege('1.2', 4, 300, busy, 0)
    const b = newSiege('1.2', 4, 300, busy, 0)
    expect(a).toEqual(b)
  })

  it('is a different siege at a different crossroad', () => {
    const a = newSiege('1.2', 4, 300, busy, 0)
    const b = newSiege('1.3', 4, 300, busy, 0)
    expect(a.towers.map((t) => t.value)).not.toEqual(b.towers.map((t) => t.value))
  })

  it('leaves the middle of the wall clear, whatever the stage', () => {
    // The bay the gate is in. No tower may stand there — the men would come out from under
    // one, and the arch would be drawn behind a tower that covers it.
    for (let stage = FIRST_STAGE; stage <= STAGE_FULL + 10; stage++) {
      const siege = newSiege('1', stage, 42, zeros, 0)
      // Half a bay is the closest a tower on an even wall comes, and floating point lands
      // it a hair under that rather than on it.
      const clear = 1 / siege.towers.length / 2 - 1e-9
      for (const tower of siege.towers) {
        expect(Math.abs(tower.at - 0.5)).toBeGreaterThan(clear)
      }
    }
  })

  it('spreads the towers evenly along it', () => {
    const siege = newSiege('1', 5, 9, zeros, 0)
    const places = siege.towers.map((tower) => tower.at).sort((a, b) => a - b)
    const bay = 1 / places.length
    places.forEach((at, i) => {
      expect(at).toBeCloseTo((i + 0.5) * bay)
    })
  })

  it('counts only standing towers as live', () => {
    const siege = newSiege('1', FIRST_STAGE, 5, zeros, 0)
    const flattened = {
      ...siege,
      towers: siege.towers.map((t, i) => (i === 0 ? { ...t, left: 0 } : t)),
    }
    expect(liveValues(flattened)).toHaveLength(siege.towers.length - 1)
    expect(liveValues(flattened)).not.toContain(siege.towers[0]?.value)
  })
})

describe('land', () => {
  const siege = newSiege('1', FIRST_STAGE, 42, zeros, 0)
  const first = siege.towers[0]
  if (first === undefined) throw new Error('a siege with no towers')

  it('chips the tower whose number was arrived at', () => {
    const hit = land(scrambled(siege), 0, first.value, zeros, 0)
    expect(hit.tower?.id).toBe(first.id)
    expect(hit.tower?.left).toBe(first.left - 1)
    expect(hit.siege.towers[0]?.left).toBe(first.left - 1)
    expect(hit.warrior).toBeNull()
    expect(hit.taken).toBe(false)
  })

  it('resolves nothing when the sum did not move, but still spends the press', () => {
    const hit = land(siege, first.value, first.value, zeros, 0)
    expect(hit.tower).toBeNull()
    expect(hit.warrior).toBeNull()
    expect(hit.siege.towers).toBe(siege.towers)
    expect(hit.siege.blow).toBeNull()
    expect(hit.siege.presses).toBe(siege.presses + 1)
  })

  it('resolves nothing on a number no one answers to', () => {
    const live = new Set(liveValues(siege))
    const quiet = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const hit = land(siege, 0, quiet, zeros, 0)
    expect(hit.tower).toBeNull()
    expect(hit.warrior).toBeNull()
  })

  it('leaves rubble alone', () => {
    const flat = {
      ...scrambled(siege),
      towers: siege.towers.map((t) => (t.id === first.id ? { ...t, left: 0 } : t)),
    }
    const hit = land(flat, 0, first.value, zeros, 0)
    expect(hit.tower).toBeNull()
    expect(hit.siege.towers[0]?.left).toBe(0)
  })

  it('calls the village taken on the hit that flattens the last tower', () => {
    const nearly = {
      ...scrambled(siege),
      towers: siege.towers.map((t, i) => ({ ...t, left: i === 0 ? 1 : 0 })),
    }
    const hit = land(nearly, 0, first.value, zeros, 0)
    expect(hit.taken).toBe(true)
  })

  it('asks a new number of a tower left standing', () => {
    const hit = land(scrambled(siege), 0, first.value, zeros, 0)
    expect(hit.tower?.left).toBeGreaterThan(0)
    expect(hit.tower?.value).not.toBe(first.value)
  })

  it('never asks a number already live, nor the one the dial is holding', () => {
    // Every hit of a whole wall, one tower at a time, against a grid that has been dialled.
    let walls = newSiege('1', STAGE_FULL, 77, busy, 0)
    for (let i = 0; i < 40; i++) {
      const standing = walls.towers.find((tower) => tower.left > 0)
      if (standing === undefined) break
      const before = liveValues(walls).filter((value) => value !== standing.value)
      const hit = land(scrambled(walls), 0, standing.value, busy, 0)
      const now = hit.siege.towers.find((tower) => tower.id === standing.id)
      if (now === undefined || now.left === 0) {
        walls = hit.siege
        continue
      }
      expect(now.value).not.toBe(standing.value)
      expect(before).not.toContain(now.value)
      // And still a number this grid can actually be dialled to.
      expect(parTable(NINE_DIAL, busy)[now.value]).toBeGreaterThanOrEqual(SIEGE_PAR_MIN)
      walls = hit.siege
    }
  })

  it('leaves the number on a tower it flattens', () => {
    const nearly = {
      ...scrambled(siege),
      towers: siege.towers.map((t) => (t.id === first.id ? { ...t, left: 1 } : t)),
    }
    const hit = land(nearly, 0, first.value, zeros, 0)
    expect(hit.tower?.left).toBe(0)
    expect(hit.tower?.value).toBe(first.value)
  })

  it('records the blow a tower took, and says when it was the last', () => {
    const hit = land(scrambled(siege), 0, first.value, zeros, 0)
    expect(hit.siege.blow?.tower).toEqual({ id: first.id, felled: false })
    expect(hit.siege.blow?.warrior).toBeNull()
    const nearly = {
      ...scrambled(siege),
      towers: siege.towers.map((t) => (t.id === first.id ? { ...t, left: 1 } : t)),
    }
    expect(land(nearly, 0, first.value, zeros, 0).siege.blow?.tower?.felled).toBe(true)
  })

  it('counts the blows up, so no two are the same effect', () => {
    const one = land(scrambled(siege), 0, first.value, zeros, 0).siege
    const standing = one.towers.find((t) => t.left > 0)
    if (standing === undefined) throw new Error('a wall with nothing standing')
    const two = land(scrambled(one), 0, standing.value, zeros, 0).siege
    expect(two.blow?.id).toBe((one.blow?.id ?? 0) + 1)
  })

  it('records where on the ground a man was cut down', () => {
    const live = new Set(liveValues(siege))
    const free = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const withWarrior = {
      ...siege,
      warriors: [{ id: 'w0', value: free, spawnedAt: 1000, walkMs: 4000, lane: 0.3 }],
    }
    const hit = land(withWarrior, 0, free, zeros, 3000)
    expect(hit.siege.blow?.warrior).toEqual({ lane: 0.3, at: 0.5, value: free })
    expect(hit.siege.blow?.tower).toBeNull()
  })

  it('holds a man at the ends of his walk however late the press lands', () => {
    const live = new Set(liveValues(siege))
    const free = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const warriors = [{ id: 'w0', value: free, spawnedAt: 1000, walkMs: 4000, lane: 0 }]
    expect(land({ ...siege, warriors }, 0, free, zeros, 0).siege.blow?.warrior?.at).toBe(
      0,
    )
    expect(
      land({ ...siege, warriors }, 0, free, zeros, 90000).siege.blow?.warrior?.at,
    ).toBe(1)
  })

  // The one thing in a siege that pays for reading the wall rather than hurrying at it: a
  // route of exactly par brings the whole tower down, however many hits it was standing
  // for. Par is counted from `refGrid`, which a siege stamps on arrival and re-stamps after
  // every hit — so these tests set the presses *just short* of par and let the landing one
  // make it up.
  describe('a clean route', () => {
    const par = computePar(NINE_DIAL, zeros, first.value)

    it('fells the tower whole, however many hits it had left', () => {
      const tall = {
        ...siege,
        towers: siege.towers.map((t) => (t.id === first.id ? { ...t, left: 5 } : t)),
        presses: par - 1,
      }
      const hit = land(tall, 0, first.value, zeros, 0)
      expect(hit.tower?.left).toBe(0)
      expect(hit.siege.blow?.tower).toEqual({ id: first.id, felled: true })
    })

    it('chips by one when a press was wasted on the way', () => {
      const tall = {
        ...siege,
        towers: siege.towers.map((t) => (t.id === first.id ? { ...t, left: 5 } : t)),
        presses: par + 3,
      }
      expect(land(tall, 0, first.value, zeros, 0).tower?.left).toBe(4)
    })

    it('takes a whole first-stage wall down in one answer per tower', () => {
      let walls = siege
      for (const tower of siege.towers) {
        const standing = walls.towers.find((t) => t.id === tower.id)
        if (standing === undefined) throw new Error('a wall that lost a tower')
        const steps = computePar(NINE_DIAL, walls.refGrid, standing.value)
        walls = land({ ...walls, presses: steps - 1 }, 0, standing.value, zeros, 0).siege
      }
      expect(walls.towers.every((t) => t.left === 0)).toBe(true)
    })
  })

  describe('the presses an answer is billed', () => {
    it('counts every press and starts afresh on a hit', () => {
      const one = land(siege, 0, 0, zeros, 0).siege
      expect(one.presses).toBe(1)
      const two = land(one, 0, 0, zeros, 0).siege
      expect(two.presses).toBe(2)
      const landed = land(scrambled(two), 0, first.value, zeros, 0).siege
      expect(landed.presses).toBe(0)
      expect(landed.refGrid).toEqual(zeros)
    })

    it('starts the first answer from the dial the hero arrived holding', () => {
      expect(newSiege('1', FIRST_STAGE, 42, busy, 0).refGrid).toEqual(busy)
    })

    it('starts afresh on a warrior cut down too', () => {
      const live = new Set(liveValues(siege))
      const free = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
      const withWarrior = {
        ...scrambled(siege),
        warriors: [{ id: 'w0', value: free, spawnedAt: 0, walkMs: 5000, lane: 0 }],
      }
      expect(land(withWarrior, 0, free, busy, 0).siege.presses).toBe(0)
      expect(land(withWarrior, 0, free, busy, 0).siege.refGrid).toEqual(busy)
    })
  })

  it('kills the warrior whose number was arrived at', () => {
    const live = new Set(liveValues(siege))
    const free = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const withWarrior = {
      ...siege,
      warriors: [{ id: 'w0', value: free, spawnedAt: 0, walkMs: 5000, lane: 0 }],
    }
    const hit = land(withWarrior, 0, free, zeros, 0)
    expect(hit.warrior?.id).toBe('w0')
    expect(hit.siege.warriors).toEqual([])
    expect(hit.tower).toBeNull()
  })
})

describe('the schedule a village sends its warriors on', () => {
  it('walks faster the later the stage', () => {
    expect(warriorWalk(STAGE_FULL)).toBeLessThan(warriorWalk(FIRST_STAGE))
    for (let stage = FIRST_STAGE + 1; stage <= STAGE_FULL + 10; stage++) {
      expect(warriorWalk(stage)).toBeLessThanOrEqual(warriorWalk(stage - 1))
    }
  })

  it('sends them faster the longer the fight drags on', () => {
    const siege = newSiege('1', FIRST_STAGE, 3, zeros, 0)
    const later = { ...siege, spawned: 10 }
    expect(spawnGap(later)).toBeLessThan(spawnGap(siege))
  })

  it('sends them faster at a later stage too', () => {
    const early = newSiege('1', FIRST_STAGE, 3, zeros, 0)
    const late = newSiege('1', STAGE_FULL, 3, zeros, 0)
    expect(spawnGap(late)).toBeLessThan(spawnGap(early))
  })

  it('gives a warrior a number nothing else is answering to', () => {
    let siege = newSiege('1', STAGE_FULL, 11, busy, 0)
    for (let i = 0; i < 3; i++) {
      const before = liveValues(siege)
      siege = spawnWarrior(siege, busy, i * 1000)
      const fresh = siege.warriors[siege.warriors.length - 1]
      if (fresh === undefined) continue
      expect(before).not.toContain(fresh.value)
    }
    expect(new Set(liveValues(siege)).size).toBe(liveValues(siege).length)
  })

  it('holds off once the ground is full, which is one man at the first stage', () => {
    let siege = newSiege('1', FIRST_STAGE, 11, busy, 0)
    for (let i = 0; i < 8; i++) siege = spawnWarrior(siege, busy, i * 1000)
    expect(siege.warriors).toHaveLength(WARRIORS_LIVE_ONE)

    let late = newSiege('1', STAGE_FULL, 11, busy, 0)
    for (let i = 0; i < 8; i++) late = spawnWarrior(late, busy, i * 1000)
    expect(late.warriors).toHaveLength(WARRIORS_LIVE_FULL)
  })

  it('says when the next thing happens', () => {
    const siege = newSiege('1', FIRST_STAGE, 11, zeros, 1000)
    expect(nextEvent(siege)).toBe(siege.nextAt)
    const marching = {
      ...siege,
      warriors: [{ id: 'w0', value: 5, spawnedAt: 1000, walkMs: 100, lane: 0 }],
    }
    expect(nextEvent(marching)).toBe(1100)
  })

  it('advances one event at a time, and says when a heart went', () => {
    const siege = newSiege('1', FIRST_STAGE, 11, zeros, 0)
    const arriving = {
      ...siege,
      warriors: [{ id: 'w0', value: 99, spawnedAt: 0, walkMs: 100, lane: 0 }],
    }
    const first = advance(arriving, zeros, 200)
    expect(first.lost).toBe(true)
    expect(first.siege.warriors).toEqual([])

    const second = advance(siege, zeros, siege.nextAt)
    expect(second.lost).toBe(false)
    expect(second.siege.warriors).toHaveLength(1)
  })

  it('does nothing when nothing is due', () => {
    const siege = newSiege('1', FIRST_STAGE, 11, zeros, 0)
    const quiet = advance(siege, zeros, siege.nextAt - 1)
    expect(quiet.siege).toBe(siege)
    expect(quiet.lost).toBe(false)
  })

  // The grace the constant names has to be the grace the player gets. A siege is built the
  // moment the hero reaches the gate and is not fought until the camera has come down on
  // it, so a `nextAt` left at the arrival would have burned most of a second behind a dial
  // that answers nothing.
  it('starts the gate clock when the fight does, not when the hero arrives', () => {
    const arrived = newSiege('1', FIRST_STAGE, 11, zeros, 1000)
    const fighting = opened(arrived, 1760)
    expect(fighting.nextAt).toBe(1760 + SPAWN_FIRST_ONE)
    expect(fighting.towers).toBe(arrived.towers)
  })

  it('keeps every walk where it was across a pause', () => {
    let siege = newSiege('1', FIRST_STAGE, 11, zeros, 0)
    siege = spawnWarrior(siege, zeros, 1000)
    const paused = shift(siege, 5000)
    expect(paused.nextAt).toBe(siege.nextAt + 5000)
    expect(paused.warriors[0]?.spawnedAt).toBe((siege.warriors[0]?.spawnedAt ?? 0) + 5000)
    expect(paused.warriors[0]?.walkMs).toBe(siege.warriors[0]?.walkMs)
  })

  // A refactor that checked the gate before the ground would spawn a fresh warrior on the
  // same call that should have collected an overdue one — the player would lose a heart
  // and get a new foe out of the same tick. `spawned` staying put is what proves the gate
  // was never asked.
  it('takes the arrival first when the gate is also due', () => {
    const siege = newSiege('1', FIRST_STAGE, 11, zeros, 0)
    const overdue = {
      ...siege,
      nextAt: 0,
      warriors: [{ id: 'w0', value: 99, spawnedAt: 0, walkMs: 100, lane: 0 }],
    }
    const result = advance(overdue, zeros, 1000)
    expect(result.lost).toBe(true)
    expect(result.siege.warriors).toEqual([])
    expect(result.siege.spawned).toBe(overdue.spawned)
  })

  // The full-ground branch still has to move `nextAt`, or a village that fills its ground
  // never schedules another look — the hook's one timer would re-fire on the same instant
  // forever instead of waiting out the gap.
  it('still advances the clock when the ground is full', () => {
    const siege = newSiege('1', FIRST_STAGE, 11, busy, 0)
    const full = {
      ...siege,
      warriors: [
        { id: 'w0', value: 101, spawnedAt: 0, walkMs: 100000, lane: 0 },
        { id: 'w1', value: 102, spawnedAt: 0, walkMs: 100000, lane: 0 },
        { id: 'w2', value: 103, spawnedAt: 0, walkMs: 100000, lane: 0 },
      ],
    }
    const result = advance(full, busy, full.nextAt)
    expect(result.lost).toBe(false)
    expect(result.siege.warriors).toHaveLength(3)
    expect(result.siege.nextAt).toBeGreaterThan(full.nextAt)
  })
})
