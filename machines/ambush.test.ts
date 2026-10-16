import { describe, expect, it } from 'vitest'

import { BANDITS_FULL, BANDITS_ONE, SPOIL_FOOD, SPOIL_HEART } from '@/constants/ambush'
import { HEARTS } from '@/constants/siege'
import { FIRST_STAGE, STAGE_FULL } from '@/lib/arcade-stage'
import { ARCADE_DIAL } from '@/machines/arcade'
import { computePar } from '@/machines/scoring'
import type { Grid } from '@/modes'

import {
  advance,
  banditCount,
  land,
  newAmbush,
  nextEvent,
  paidAs,
  shift,
  spoilOf,
  sprung,
  walked,
  type Ambush,
} from './ambush'

const busy: Grid = [3, 7, 1, 9, 2, 4, 0, 6, 8]

// A road as the hero would actually meet it: built, then sprung, so every man is walking.
const road = (
  at = '1.2',
  stage = FIRST_STAGE,
  seed = 7,
  cutDown: readonly string[] = [],
): Ambush => sprung(newAmbush(at, stage, seed, busy, cutDown), 0)

describe('banditCount', () => {
  it('stands a few on a first-stage road and a band on a last-stage one', () => {
    expect(banditCount(FIRST_STAGE)).toBe(BANDITS_ONE)
    expect(banditCount(STAGE_FULL)).toBe(BANDITS_FULL)
  })

  it('never shrinks as the stages climb, and never grows past the last', () => {
    for (let stage = FIRST_STAGE + 1; stage <= STAGE_FULL + 20; stage++) {
      expect(banditCount(stage)).toBeGreaterThanOrEqual(banditCount(stage - 1))
      expect(banditCount(stage)).toBeLessThanOrEqual(BANDITS_FULL)
    }
  })

  it('closes on the hero sooner at a later stage', () => {
    const early = road('1.0', FIRST_STAGE)
    const late = road('1.0', STAGE_FULL)
    expect(nextEvent(late) ?? 0).toBeLessThan(nextEvent(early) ?? 0)
  })
})

describe('newAmbush', () => {
  it('deals the whole band, every man answering a number no other does', () => {
    const ambush = road()
    expect(ambush.bandits).toHaveLength(banditCount(FIRST_STAGE))
    const values = ambush.bandits.map((bandit) => bandit.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('deals numbers the dial can actually reach from the grid handed in', () => {
    for (const bandit of road('3.1', 6, 41).bandits) {
      expect(computePar(ARCADE_DIAL, busy, bandit.value)).toBeGreaterThan(0)
    }
  })

  it('spreads the band round the hero, never two on one line', () => {
    const bearings = road('2.0', 7, 11)
      .bandits.map((bandit) => bandit.bearing)
      .sort((a, b) => a - b)
    const slot = (Math.PI * 2) / bearings.length
    for (let i = 1; i < bearings.length; i++) {
      const gap = (bearings[i] ?? 0) - (bearings[i - 1] ?? 0)
      expect(gap).toBeGreaterThan(slot * 0.5)
    }
  })

  it('stands the man due first nearest the hero', () => {
    const band = [...road('4.1', 5, 3).bandits].sort(
      (a, b) => a.spawnedAt + a.walkMs - (b.spawnedAt + b.walkMs),
    )
    for (let i = 1; i < band.length; i++) {
      expect(band[i]?.from ?? 0).toBeGreaterThan(band[i - 1]?.from ?? 0)
    }
  })

  it('deals the same road twice', () => {
    expect(road('5.2', 4, 23)).toEqual(road('5.2', 4, 23))
  })

  it('deals a different road differently', () => {
    const here = road('5.2', 4, 23).bandits.map((b) => b.bearing)
    const there = road('5.3', 4, 23).bandits.map((b) => b.bearing)
    expect(here).not.toEqual(there)
  })
})

describe('newAmbush, on a road already fought over', () => {
  it('leaves out the men already cut down and nobody else', () => {
    const whole = road('6.0', 5, 5)
    const gone = [whole.bandits[1]?.id ?? '', whole.bandits[3]?.id ?? '']
    const again = road('6.0', 5, 5, gone)
    expect(again.bandits).toHaveLength(whole.bandits.length - 2)
    expect(again.bandits.map((bandit) => bandit.id)).toEqual(
      whole.bandits.filter((bandit) => !gone.includes(bandit.id)).map((b) => b.id),
    )
  })

  it('leaves every survivor standing exactly where he stood', () => {
    const whole = road('6.1', 5, 5)
    const gone = [whole.bandits[0]?.id ?? '']
    for (const bandit of road('6.1', 5, 5, gone).bandits) {
      const before = whole.bandits.find((other) => other.id === bandit.id)
      expect(bandit.bearing).toBe(before?.bearing)
      expect(bandit.from).toBe(before?.from)
      expect(bandit.walkMs).toBe(before?.walkMs)
    }
  })

  it('carries the fallen forward, so a road is only ever worn down', () => {
    expect(road('6.2', 5, 5, ['b0', 'b2']).fallen).toEqual(['b0', 'b2'])
  })
})

describe('land', () => {
  it('cuts the man whose number the sum arrived at, and only him', () => {
    const ambush = road()
    const target = ambush.bandits[2]
    const hit = land(ambush, 0, target?.value ?? 0, 1000)
    expect(hit.bandit?.id).toBe(target?.id)
    expect(hit.ambush.bandits).toHaveLength(ambush.bandits.length - 1)
    expect(hit.ambush.fallen).toEqual([target?.id])
  })

  it('leaves a sum that moved onto nobody alone', () => {
    const ambush = road()
    const live = new Set(ambush.bandits.map((bandit) => bandit.value))
    const empty = [...Array(100).keys()].find((value) => !live.has(value)) ?? 0
    expect(land(ambush, 0, empty, 1000).ambush).toBe(ambush)
  })

  it('ignores a press that did not move the sum', () => {
    const ambush = road()
    const standing = ambush.bandits[0]?.value ?? 0
    expect(land(ambush, standing, standing, 1000).ambush).toBe(ambush)
  })

  it('reports cleared only on the last man', () => {
    const whole = road().bandits
    let ambush = road()
    for (const [i, bandit] of whole.entries()) {
      const last = i === whole.length - 1
      const hit = land(ambush, -1, bandit.value, 1000)
      expect(hit.cleared).toBe(last)
      ambush = hit.ambush
    }
    expect(ambush.bandits).toHaveLength(0)
  })

  it('leaves behind where the man was standing, for the screen to draw', () => {
    const ambush = road()
    const target = ambush.bandits[0]
    const hit = land(ambush, 0, target?.value ?? 0, (target?.walkMs ?? 0) / 2)
    expect(hit.ambush.cut?.value).toBe(target?.value)
    expect(hit.ambush.cut?.bearing).toBe(target?.bearing)
    expect(hit.ambush.cut?.at).toBeCloseTo(0.5)
  })

  it('counts its cuts up, so two a moment apart are two effects', () => {
    const ambush = road()
    const first = land(ambush, 0, ambush.bandits[0]?.value ?? 0, 10)
    const second = land(first.ambush, 0, first.ambush.bandits[0]?.value ?? 0, 20)
    expect(first.ambush.cut?.id).toBe(1)
    expect(second.ambush.cut?.id).toBe(2)
  })
})

describe('walked', () => {
  it('runs nought to one over the man’s own walk, and stops there', () => {
    const bandit = road().bandits[0]
    if (bandit === undefined) return expect.unreachable('an empty road')
    expect(walked(bandit, 0)).toBe(0)
    expect(walked(bandit, bandit.walkMs / 4)).toBeCloseTo(0.25)
    expect(walked(bandit, bandit.walkMs * 3)).toBe(1)
  })
})

describe('nextEvent', () => {
  it('is the soonest man to reach the hero', () => {
    const ambush = road()
    const soonest = Math.min(
      ...ambush.bandits.map((bandit) => bandit.spawnedAt + bandit.walkMs),
    )
    expect(nextEvent(ambush)).toBe(soonest)
  })

  it('is nothing at all once the road is clear', () => {
    expect(nextEvent({ ...road(), bandits: [] })).toBeNull()
  })
})

describe('advance', () => {
  it('holds while nobody has arrived', () => {
    const ambush = road()
    const step = advance(ambush, 10)
    expect(step.lost).toBe(false)
    expect(step.ambush).toBe(ambush)
  })

  it('costs a heart when one reaches the hero, and takes him off the ground', () => {
    const ambush = road()
    const due = nextEvent(ambush) ?? 0
    const step = advance(ambush, due)
    expect(step.lost).toBe(true)
    expect(step.ambush.bandits).toHaveLength(ambush.bandits.length - 1)
  })

  it('does not count the man who won among the fallen', () => {
    const ambush = road()
    expect(advance(ambush, nextEvent(ambush) ?? 0).ambush.fallen).toEqual([])
  })
})

describe('shift', () => {
  it('moves every man by exactly the time the player was away', () => {
    const ambush = road()
    const later = shift(ambush, 4000)
    for (const [i, bandit] of later.bandits.entries()) {
      expect(bandit.spawnedAt).toBe((ambush.bandits[i]?.spawnedAt ?? 0) + 4000)
      expect(bandit.walkMs).toBe(ambush.bandits[i]?.walkMs)
    }
  })

  it('leaves a paused man exactly as far along as he was', () => {
    const ambush = road()
    const bandit = ambush.bandits[0]
    if (bandit === undefined) return expect.unreachable('an empty road')
    const paused = walked(bandit, 1200)
    const resumed = shift(ambush, 9000).bandits[0]
    if (resumed === undefined) return expect.unreachable('a man lost to the pause')
    expect(walked(resumed, 1200 + 9000)).toBeCloseTo(paused)
  })
})

describe('spoilOf', () => {
  it('pays one road the same thing however often it is asked', () => {
    expect(spoilOf('2.1', 88)).toBe(spoilOf('2.1', 88))
  })

  it('pays all three across a run, and food the most often', () => {
    const paid = Array.from({ length: 300 }, (_, i) =>
      spoilOf(`${i}.${i % 4}`, Math.imul(i + 1, 2654435761) >>> 0),
    )
    const share = (spoil: string) =>
      paid.filter((one) => one === spoil).length / paid.length
    expect(share('food')).toBeGreaterThan(0.3)
    expect(share('heart')).toBeGreaterThan(0.05)
    expect(share('nothing')).toBeGreaterThan(0.1)
    // The weights are cuts of one roll, so the three shares are the three bands of it.
    expect(share('food')).toBeCloseTo(SPOIL_FOOD, 0)
    expect(share('heart')).toBeCloseTo(SPOIL_HEART - SPOIL_FOOD, 0)
  })
})

describe('paidAs', () => {
  it('pays a heart to a hero with one to spare', () => {
    expect(paidAs('heart', HEARTS - 1)).toBe('heart')
  })

  it('pays food instead to a hero already carrying three', () => {
    expect(paidAs('heart', HEARTS)).toBe('food')
  })

  it('leaves the other two alone whatever the hero is carrying', () => {
    expect(paidAs('food', HEARTS)).toBe('food')
    expect(paidAs('nothing', 1)).toBe('nothing')
  })
})
