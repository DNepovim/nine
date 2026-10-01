import { describe, expect, it } from 'vitest'

import { featureIn, type LandFeature } from '@/machines/arcade-land'
import type { RegionKey } from '@/machines/arcade-regions'

import { drawFeature } from './map-marks'

const PITCH = 132
const open = () => false

const sweep = (region: RegionKey): LandFeature[] => {
  const found: LandFeature[] = []
  for (let gy = -8; gy < 8; gy++) {
    for (let gx = -8; gx < 8; gx++) {
      const f = featureIn(region, gx, gy, 2026, open)
      if (f !== null) found.push(f)
    }
  }
  return found
}

const everything = (['farmland', 'forest', 'hills', 'mountains'] as const).flatMap(sweep)

// The sweep above always finds plenty, but a test that indexes an array has to say what it
// means by "there is one" rather than assert its way past the question.
function must(feature: LandFeature | undefined): LandFeature {
  if (feature === undefined) throw new Error('the sweep found no feature to draw')
  return feature
}

// Every number in a path, so the test can ask whether any of them is nonsense.
const numbers = (d: string): number[] =>
  (d.match(/-?\d+(\.\d+)?/g) ?? []).map((v) => Number(v))

describe('drawFeature', () => {
  it('draws the same feature the same way every time', () => {
    const feature = must(everything[3])
    expect(drawFeature(feature, PITCH)).toEqual(drawFeature(feature, PITCH))
  })

  it('gives every mark a closed body, so it can knock out what is behind it', () => {
    for (const feature of everything) {
      const drawn = drawFeature(feature, PITCH)
      expect(drawn.marks.length).toBeGreaterThan(0)
      for (const mark of drawn.marks) {
        // A bare stand is the one mark with no canopy to fill — it is branches and nothing
        // else, and it is the only feature allowed an empty body.
        if (mark.body === '') continue
        expect(mark.body.startsWith('M')).toBe(true)
        expect(mark.body.endsWith('Z')).toBe(true)
      }
    }
  })

  it('never emits a coordinate that is not a number', () => {
    for (const feature of everything) {
      const drawn = drawFeature(feature, PITCH)
      for (const mark of drawn.marks) {
        for (const value of [...numbers(mark.body), ...numbers(mark.detail)]) {
          expect(Number.isFinite(value)).toBe(true)
        }
      }
    }
  })

  it('keeps every mark inside the box it reports', () => {
    for (const feature of everything) {
      const drawn = drawFeature(feature, PITCH)
      for (const mark of drawn.marks) {
        for (const value of [...numbers(mark.body), ...numbers(mark.detail)]) {
          expect(value).toBeGreaterThan(-2)
          expect(value).toBeLessThan(Math.max(drawn.width, drawn.height) + 2)
        }
      }
    }
  })

  it('draws a range peak by peak and a wood all at once', () => {
    const ridge = everything.find((f) => f.kind === 'ridge' && f.peaks.length > 1)
    const wood = everything.find((f) => f.kind === 'wood' && f.trees.length > 1)
    expect(drawFeature(must(ridge), PITCH).marks.length).toBeGreaterThan(1)
    // A wood is one mark however many trees are in it: within a wood the canopies are inked
    // flat over each other, which is how a mass of trees is drawn and what keeps a forest
    // from costing four hundred paths.
    expect(drawFeature(must(wood), PITCH).marks).toHaveLength(1)
  })

  it('scales with the pitch, so a taller canvas gets the same country bigger', () => {
    const feature = must(everything.find((f) => f.kind === 'ridge'))
    const small = drawFeature(feature, 100)
    const big = drawFeature(feature, 200)
    expect(big.width / small.width).toBeGreaterThan(1.5)
  })
})
