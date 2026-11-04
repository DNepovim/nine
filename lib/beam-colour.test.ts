import { describe, expect, it } from 'vitest'

import { LIGHTS_OUT, SCHEMES } from '@/constants/colors'
import { contrastRatio } from '@/lib/contrast'
import { mixHex } from '@/lib/mix-hex'

import { beamColour, beamStep } from './beam-colour'

describe('beamStep', () => {
  it('runs from the top step at a full clock to nought at an empty one', () => {
    expect(beamColour(beamStep(1))).toBe(LIGHTS_OUT.beam)
    expect(beamStep(0)).toBe(0)
  })

  it('never climbs as the clock runs down', () => {
    expect(beamStep(0.4)).toBeLessThanOrEqual(beamStep(0.6))
  })
})

describe('beamColour', () => {
  it('goes from warm white through orange to red', () => {
    expect(beamColour(beamStep(1))).toBe(LIGHTS_OUT.beam)
    expect(beamColour(beamStep(0.5))).toBe(LIGHTS_OUT.beamLow)
    expect(beamColour(beamStep(0))).toBe(LIGHTS_OUT.beamOut)
  })

  // The number is dark paint in the beam, large and bold, so it holds the 3:1 large text is
  // owed: at the reddest and with the pool fully closed, where a three-figure number's outer
  // digits reach (about 0.8 of the beam), mid-stutter.
  it('keeps the painted number readable to the very end', () => {
    const lit = mixHex(SCHEMES.dark.inks.ground, beamColour(beamStep(0)), 0.8 * 0.85)
    expect(contrastRatio(LIGHTS_OUT.paint, lit)).toBeGreaterThanOrEqual(3)
  })
})
