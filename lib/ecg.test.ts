import { describe, expect, it } from 'vitest'

import { BEAT_WIDTH, beatPoints, fibrillationPath, heartbeatScale } from '@/lib/ecg'

describe('beatPoints', () => {
  it('lies level at both ends, so beats join without a seam', () => {
    const points = beatPoints()
    expect(points[0]?.y).toBeCloseTo(0, 1)
    expect(points[points.length - 1]?.y).toBeCloseTo(0, 1)
    expect(points[points.length - 1]?.x).toBe(BEAT_WIDTH)
  })

  it('peaks in its R wave, higher than anything else in the beat', () => {
    const points = beatPoints()
    const top = points.reduce((best, point) => (point.y < best.y ? point : best), {
      x: 0,
      y: 0,
    })
    expect(top.x).toBeGreaterThan(95)
    expect(top.x).toBeLessThan(110)
    expect(top.y).toBeLessThan(-40)
  })
})

describe('fibrillationPath', () => {
  it('is the same mess for the same seed and another for a different one', () => {
    expect(fibrillationPath(1, 300, 30, 80)).toBe(fibrillationPath(1, 300, 30, 80))
    expect(fibrillationPath(1, 300, 30, 80)).not.toBe(fibrillationPath(2, 300, 30, 80))
  })
})

describe('heartbeatScale', () => {
  it('swells twice in a beat, the first the more, and then rests', () => {
    expect(heartbeatScale(0)).toBe(1)
    const lub = heartbeatScale(0.1)
    const dub = heartbeatScale(0.3)
    expect(lub).toBeGreaterThan(dub)
    expect(dub).toBeGreaterThan(1)
    expect(heartbeatScale(0.2)).toBeCloseTo(1)
    for (let phase = 0.4; phase < 1; phase += 0.05) {
      expect(heartbeatScale(phase)).toBe(1)
    }
  })

  it('zooms only a little, never more than a tenth', () => {
    for (let phase = 0; phase < 1; phase += 0.01) {
      expect(heartbeatScale(phase)).toBeLessThan(1.1)
    }
  })
})
