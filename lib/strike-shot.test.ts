import { describe, expect, it } from 'vitest'

import {
  BURST_CADENCE_MS,
  BURST_MS,
  BURST_ROUNDS,
  burstRounds,
  insetLine,
  shareRounds,
  shotLine,
} from './strike-shot'

const MUZZLE = { x: 100, y: 300 }
const ABOVE = { x: 100, y: 100 }

describe('shotLine', () => {
  it('measures a target straight above the muzzle as a quarter turn back', () => {
    expect(shotLine(MUZZLE, ABOVE)).toEqual({ length: 200, angle: -90 })
  })

  it('measures a target straight to the right as no turn at all', () => {
    expect(shotLine({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ length: 10, angle: 0 })
  })

  it('measures the diagonal', () => {
    const { length, angle } = shotLine({ x: 0, y: 0 }, { x: 3, y: 4 })
    expect(length).toBe(5)
    expect(angle).toBeCloseTo(53.13, 1)
  })
})

describe('shareRounds', () => {
  it('gives one target the whole burst', () => {
    expect(shareRounds(1)).toEqual([[0, 1, 2, 3, 4]])
  })

  it('deals the rounds round-robin so the stream sweeps between targets', () => {
    expect(shareRounds(2)).toEqual([
      [0, 2, 4],
      [1, 3],
    ])
  })

  it('never fires more than one burst however many targets a press takes', () => {
    const dealt = shareRounds(3).flat()
    expect(dealt).toHaveLength(BURST_ROUNDS)
    expect(new Set(dealt).size).toBe(BURST_ROUNDS)
  })

  it('deals nothing when the press took nothing', () => {
    expect(shareRounds(0)).toEqual([])
  })
})

describe('burstRounds', () => {
  it('fires one round per index it is given', () => {
    expect(burstRounds(MUZZLE, ABOVE, 40, [0, 1, 2, 3, 4])).toHaveLength(5)
  })

  it('leaves the muzzle on the cadence of the whole burst, not of its own share', () => {
    const rounds = burstRounds(MUZZLE, ABOVE, 40, [1, 3])
    expect(rounds.map((r) => r.delay)).toEqual([BURST_CADENCE_MS, BURST_CADENCE_MS * 3])
  })

  it('aims a lone round at the middle of the target', () => {
    const [round] = burstRounds(MUZZLE, ABOVE, 40, [2])
    expect(round?.angle).toBe(shotLine(MUZZLE, ABOVE).angle)
  })

  it('spreads the rounds symmetrically across the face', () => {
    const rounds = burstRounds(MUZZLE, ABOVE, 40, [0, 1, 2, 3, 4])
    const middle = shotLine(MUZZLE, ABOVE).angle
    const offsets = rounds.map((r) => r.angle - middle)
    expect(offsets[2]).toBeCloseTo(0, 6)
    expect(offsets[0]).toBeCloseTo(-(offsets[4] ?? 0), 6)
    expect(offsets[1]).toBeCloseTo(-(offsets[3] ?? 0), 6)
  })

  it('keeps every round inside the face rather than out past the rim', () => {
    const radius = 40
    const rounds = burstRounds(MUZZLE, ABOVE, radius, [0, 1, 2, 3, 4])
    for (const round of rounds) {
      // Distance from the aim point to the centre, by the triangle the offset makes.
      const reach = Math.abs(
        round.length *
          Math.sin(((round.angle - shotLine(MUZZLE, ABOVE).angle) * Math.PI) / 180),
      )
      expect(reach).toBeLessThan(radius)
    }
  })

  it('runs the whole burst inside its stated window', () => {
    expect(BURST_MS).toBeGreaterThan(BURST_CADENCE_MS * (BURST_ROUNDS - 1))
  })
})

describe('insetLine', () => {
  it('holds both gaps clear when there is room for them', () => {
    expect(insetLine(200, 28, 48)).toEqual({ offset: 28, length: 124 })
  })

  it('keeps what is left centred when the gaps would eat the whole run', () => {
    // 60 long against 76 of gaps: both ends give way together rather than one winning.
    const { offset, length } = insetLine(60, 28, 48)
    expect(length).toBe(16)
    expect(offset).toBe(22)
    expect(offset + length).toBeLessThanOrEqual(60)
  })

  it('never draws a bar longer than the ray it lies on', () => {
    const { offset, length } = insetLine(10, 28, 48)
    expect(length).toBe(10)
    expect(offset).toBe(0)
  })

  it('never draws a bar backwards', () => {
    for (const ray of [0, 5, 40, 76, 77, 300]) {
      expect(insetLine(ray, 28, 48).length).toBeGreaterThanOrEqual(0)
    }
  })
})
