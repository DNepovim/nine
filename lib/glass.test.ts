import { describe, expect, it } from 'vitest'

import { GAME_SCALE } from '@/constants/colors'

import {
  GLASS_SHEEN_UNTIL,
  GLASS_TINT,
  glassTones,
  withAlpha,
  type GlassTones,
} from './glass'

const RGBA = /^rgba\((\d{1,3}), (\d{1,3}), (\d{1,3}), (0(\.\d+)?|1)\)$/

// Reads either spelling, so a tone can be compared against the plain hex it came from.
const parse = (colour: string): { r: number; g: number; b: number; a: number } => {
  if (colour.startsWith('#')) {
    return {
      r: parseInt(colour.slice(1, 3), 16),
      g: parseInt(colour.slice(3, 5), 16),
      b: parseInt(colour.slice(5, 7), 16),
      a: 1,
    }
  }
  const match = RGBA.exec(colour)
  if (match === null) throw new Error(`not an rgba colour: ${colour}`)
  const [, r, g, b, a] = match
  return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) }
}

// Enough of a luminance to order two tones by lightness, which is all these ask.
const light = (rgba: string): number => {
  const { r, g, b } = parse(rgba)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// The order the channels sit in — a lerp towards white or black cannot reorder them, and
// a lerp towards any other colour eventually does, which is what makes this a hue check.
const order = (rgba: string): string => {
  const { r, g, b } = parse(rgba)
  return [r, g, b]
    .map((value, i) => [value, i] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, i]) => i)
    .join('')
}

const tones = (base: string): GlassTones[keyof GlassTones][] => {
  const t = glassTones(base)
  return [t.pane, t.rim, t.far]
}

describe('glassTones', () => {
  it('keeps the colour it was given, and lets the surface through it', () => {
    expect(glassTones('#c36282').pane).toBe(`rgba(195, 98, 130, ${GLASS_TINT})`)
  })

  it('moves only the value, never the hue', () => {
    // Every colour a big title is drawn in comes off one of these. A pane that drifted
    // off the hue would be the one thing this effect must not do.
    for (const base of GAME_SCALE) {
      for (const tone of tones(base)) {
        expect(order(tone), `${base} → ${tone}`).toBe(order(base))
      }
    }
  })

  it('lights the top rim and darkens the far edge', () => {
    const t = glassTones('#7273D2')
    expect(light(t.rim)).toBeGreaterThan(light(t.pane))
    expect(light(t.pane)).toBeGreaterThan(light(t.far))
  })

  it('makes the rim the most solid part of the pane', () => {
    // A lit edge is where a pane stops being see-through. One that faded with the rest
    // would read as a glow rather than as an edge.
    const t = glassTones('#4C7EFF')
    expect(parse(t.rim).a).toBeGreaterThan(parse(t.pane).a)
  })

  it('survives a colour with nowhere left to go', () => {
    // The letters run through white at the peak of a mode switch, and black is what a
    // dark theme's ink would hand this. Neither may produce a channel off the end.
    for (const base of ['#ffffff', '#000000']) {
      for (const tone of tones(base)) {
        expect(tone).toMatch(RGBA)
      }
    }
  })

  it('keeps the sheen to the top of the pane', () => {
    // Past the middle it stops being a reflection and starts being a second colour.
    expect(GLASS_SHEEN_UNTIL).toBeGreaterThan(0)
    expect(GLASS_SHEEN_UNTIL).toBeLessThan(0.5)
  })

  it('writes an alpha the platforms accept', () => {
    expect(withAlpha('#0b0c14', 0.5)).toBe('rgba(11, 12, 20, 0.5)')
  })
})
