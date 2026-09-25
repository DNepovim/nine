import { describe, expect, it } from 'vitest'

import { NAME_INK } from '@/constants/colors'

import {
  desaturate,
  nameColors,
  nameInk,
  nameStops,
  saturationFor,
  type NameScheme,
} from './name-gradient'

const SCHEMES = ['light', 'dark'] as const satisfies readonly NameScheme[]

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

// WCAG relative luminance, and the contrast ratio built on it. Written out here rather
// than imported because the point of the test below is to check the constant against the
// standard, and sharing an implementation with the thing under test would only check it
// against itself.
const relativeLuminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

describe('saturationFor', () => {
  it('gives a full average the mode hue at full strength', () => {
    expect(saturationFor(100)).toBe(1)
  })

  it('drains the colour out of a player who has never hit anything', () => {
    // The whole of the null case: a player with no hits counted reads as 0% on both
    // factors rather than as an unknown wearing a colour of its own.
    expect(saturationFor(null)).toBe(0)
    expect(saturationFor(0)).toBe(0)
  })

  it('keeps the whole bottom half grey', () => {
    // The floor. Everything up to and including a middling average is plain grey, so
    // "coloured at all" already means better than half rather than merely present.
    for (const average of [1, 20, 40, 49, 50]) {
      expect(saturationFor(average)).toBe(0)
    }
  })

  it('climbs slowly out of the floor and quickly into the hue', () => {
    // The curve, stated as the shape rather than as four magic numbers: every step up
    // the top half is bigger than the one below it, which is what makes the difference
    // between a very good player and a merely good one the visible one.
    const steps = [50, 60, 70, 80, 90, 100].map(saturationFor)
    const gaps = steps.slice(1).map((value, index) => value - (steps[index] ?? 0))
    for (const [index, gap] of gaps.entries()) {
      expect(gap).toBeGreaterThan(gaps[index - 1] ?? 0)
    }
  })

  it('spends less than a fifth of the colour by three quarters', () => {
    // The concrete claim the curve is tuned to: a 75% average is still nearly grey.
    expect(saturationFor(75)).toBeLessThan(0.2)
    expect(saturationFor(75)).toBeGreaterThan(0)
  })

  it('holds at full past 100', () => {
    // `averagePercent` is deliberately unclamped — `speedReward` pays above the fast
    // band, so a quick player really does average over 100. They get the full hue, not
    // an overshoot there is no colour for.
    expect(saturationFor(140)).toBe(1)
  })
})

describe('desaturate', () => {
  it('returns the hue untouched at full saturation', () => {
    expect(desaturate(NAME_INK.light[0], 1)).toBe(NAME_INK.light[0])
  })

  it('collapses to a grey with no hue left at zero', () => {
    const [r, g, b] = channels(desaturate(NAME_INK.dark[1], 0))
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('holds its lightness as the colour drains', () => {
    // The reason this fades toward a luminance-matched grey rather than toward white or
    // black: a name has to stay readable at every saturation, and only a fade that
    // leaves lightness alone keeps the contrast it was designed with.
    for (const scheme of SCHEMES) {
      for (const hue of NAME_INK[scheme]) {
        const full = relativeLuminance(hue)
        for (const stop of [0, 0.25, 0.5, 0.75, 1]) {
          expect(relativeLuminance(desaturate(hue, stop))).toBeCloseTo(full, 1)
        }
      }
    }
  })

  it('always answers with a six-digit hex', () => {
    // Channels that round to a single digit have to be padded, or the colour reaches
    // React Native as a malformed string and the name renders black.
    //
    // Case-insensitive because `lerpColor` hands back its endpoint untouched at the ends
    // of the range, and a stop may be written in either case.
    for (const stop of [0, 0.1, 0.37, 0.9, 1]) {
      expect(desaturate(NAME_INK.dark[1], stop)).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('nameStops', () => {
  it('gives a player at the top of both factors the theme ink outright', () => {
    for (const scheme of SCHEMES) {
      expect(nameStops({ avgAccuracy: 100, avgSpeed: 100 }, scheme)).toEqual([
        ...nameInk(scheme),
      ])
    }
  })

  it('grades each end by its own factor', () => {
    // The point of the whole feature: an exact but slow player is violet at the front
    // and grey at the back, and the two ends move independently.
    const [from, to] = nameStops({ avgAccuracy: 100, avgSpeed: 0 }, 'light')
    expect(from).toBe(NAME_INK.light[0])
    const [r, g, b] = channels(to)
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('draws a player with nothing counted in two greys', () => {
    const stops = nameStops({ avgAccuracy: null, avgSpeed: null }, 'dark')
    for (const stop of stops) {
      const [r, g, b] = channels(stop)
      expect(r).toBe(g)
      expect(g).toBe(b)
    }
  })

  it('gives each theme its own pair', () => {
    const factors = { avgAccuracy: 90, avgSpeed: 90 }
    expect(nameStops(factors, 'light')).not.toEqual(nameStops(factors, 'dark'))
  })

  // The guard on NAME_INK. A name is text at 10px, and the mode scale it is derived from
  // is tuned to be a colour rather than to carry one — the raw stops fall to about 2.9:1
  // on the light card, which is why the pairs are shifted at all. Any future adjustment
  // has to keep clearing this on every surface at every saturation, including the grey
  // a blank career fades to.
  it.each([
    ['light', ['#f3efe9', '#e8e4dc']],
    ['dark', ['#0b0c14', '#16172a']],
  ] as const)(
    'clears 4.5:1 on both %s surfaces at every saturation',
    (scheme, grounds) => {
      for (const average of [null, 0, 25, 50, 75, 100, 140]) {
        for (const stop of nameStops(
          { avgAccuracy: average, avgSpeed: average },
          scheme,
        )) {
          for (const ground of grounds) {
            expect(contrast(stop, ground)).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    },
  )
})

describe('nameColors', () => {
  const full = { avgAccuracy: 100, avgSpeed: 100 }

  it('anchors the first and last characters to the two stops', () => {
    const letters = nameColors('DOMINO', full, 'light')
    expect(letters).toHaveLength(6)
    expect(letters[0]?.color).toBe(NAME_INK.light[0])
    expect(letters[5]?.color).toBe(NAME_INK.light[1])
  })

  it('keeps the characters in order and unchanged', () => {
    expect(nameColors('ACE', full, 'light').map((letter) => letter.char)).toEqual([
      'A',
      'C',
      'E',
    ])
  })

  it('walks code points, not UTF-16 units', () => {
    // A nickname with an emoji or a combining mark in it keeps its characters whole —
    // splitting on `.length` would tear a surrogate pair in half and colour the halves
    // differently, which renders as two replacement glyphs.
    expect(nameColors('A🎯B', full, 'light').map((letter) => letter.char)).toEqual([
      'A',
      '🎯',
      'B',
    ])
  })

  it('gives a one-character name the opening stop rather than dividing by zero', () => {
    const letters = nameColors('J', full, 'dark')
    expect(letters).toHaveLength(1)
    expect(letters[0]?.color).toBe(NAME_INK.dark[0])
  })

  it('answers an empty nickname with nothing to draw', () => {
    expect(nameColors('', full, 'light')).toEqual([])
  })
})
