import { describe, expect, it } from 'vitest'

import { ACHIEVEMENT_SCALE, GOLD_SCALE, PRIMARY_INK } from '@/constants/colors'
import { allModes } from '@/modes'
import { getDifficultyColor, meterInkOf, MULTIPLAYER_GRADIENT } from '@/modes/palette'

import { CHALLENGES } from './catalog'
import {
  CHALLENGE_ARC,
  challengeDarkGradient,
  challengeDarkPairFor,
  challengeGradient,
  challengeHue,
  challengeInk,
  challengePairFor,
  challengeTints,
  hueOf,
  TURQUOISE,
} from './palette'

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

// `hueOf` is the palette's own now — see the note there. It used to be a copy living
// here, which meant the test measured its own arithmetic rather than the one the app
// draws with.

// How saturated a hex is, 0–1. A near-black or a near-grey has a hue in the arithmetic
// sense but not in any sense a reader would recognise — `PRIMARY_INK` computes to 252°,
// which is inside the challenge arc and tells us nothing, because nobody looking at it
// sees violet. So the comparison below only considers colours vivid enough to read as a
// hue at all.
function satOf(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * l - 1))
}

const relLum = (hex: string): number => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// How far apart two hues are on the wheel, the short way round.
const apart = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

// However many challenges this is ever asked for. Twenty-odd is the number the design
// was shaped around; the arc has to behave for at least that many.
const MANY = [...Array(24).keys()]

describe('the arc a challenge hue is drawn from', () => {
  it('stays inside its own window, however many challenges there are', () => {
    for (const i of MANY) {
      const hue = challengeHue(i)
      expect(hue, `index ${i}`).toBeGreaterThanOrEqual(CHALLENGE_ARC.from)
      expect(hue, `index ${i}`).toBeLessThan(CHALLENGE_ARC.to)
    }
  })

  it('never lands on a hue the app has already given a meaning', () => {
    // The whole point of the window. A challenge wearing the gold of a record you hold,
    // the green of an achievement you keep, the teal of multiplayer or any mode's own
    // hue would be saying two things at once.
    const spokenFor = [
      // Permanent modes only. `allModes()` includes the challenges themselves now, and
      // a challenge is allowed to sit near another challenge — how far apart those are
      // is the spread test below, not this one.
      ...allModes()
        .filter((mode) => mode.window === null)
        .flatMap((mode) => [...mode.gradient, ...mode.darkGradient]),
      ...GOLD_SCALE,
      ...ACHIEVEMENT_SCALE,
      MULTIPLAYER_GRADIENT.accuracy[0],
    ]
      .filter((hex) => satOf(hex) > 0.25)
      .map(hueOf)
    for (const i of MANY) {
      for (const taken of spokenFor) {
        expect(
          apart(challengeHue(i), taken),
          `index ${i} (${Math.round(challengeHue(i))}deg) vs ${Math.round(taken)}deg`,
        ).toBeGreaterThan(10)
      }
    }
  })

  it('spreads the early challenges furthest apart', () => {
    // The golden-ratio step's reason for being: each new challenge lands in the largest
    // gap left by the ones before it, so the catalog is legible long before it is full.
    const gapAt = (n: number): number => {
      const hues = [...Array(n).keys()].map(challengeHue).sort((a, b) => a - b)
      return Math.min(...hues.slice(1).map((h, i) => h - (hues[i] ?? 0)))
    }
    expect(gapAt(4)).toBeGreaterThan(15)
    expect(gapAt(8)).toBeGreaterThan(6)
    // Monotonic: more challenges never means more room.
    expect(gapAt(8)).toBeLessThanOrEqual(gapAt(4))
  })

  it('gives a challenge the same colour every time it is asked', () => {
    for (const i of MANY) expect(challengeGradient(i)).toEqual(challengeGradient(i))
  })
})

describe('the pair itself', () => {
  it('starts on the app’s own near-black, the same for every challenge', () => {
    // The first stop is what says *this is a challenge* before the hue beside it has
    // been read: no permanent mode starts dark.
    for (const i of MANY) {
      expect(challengeGradient(i)[0]).toBe(PRIMARY_INK)
      expect(challengeDarkGradient(i)[0]).toBe(PRIMARY_INK)
    }
  })

  it('never starts on a hue a permanent mode starts on', () => {
    const modeStarts = allModes().map((mode) => mode.gradient[0])
    for (const i of MANY) expect(modeStarts).not.toContain(challengeGradient(i)[1])
  })

  it('carries white on the CTA pair, at every index', () => {
    // `darkGradient` is a button background with white text on it. 4.5:1 is the bar; the
    // arc clears it several times over, and this is what stops a future tweak to the
    // lightness quietly dropping under it.
    for (const i of MANY) {
      const [, dark] = challengeDarkGradient(i)
      expect(contrast('#ffffff', dark), `index ${i} (${dark})`).toBeGreaterThan(4.5)
    }
  })

  it('is darker on the CTA pair than on the bright one', () => {
    for (const i of MANY) {
      expect(relLum(challengeDarkGradient(i)[1])).toBeLessThan(
        relLum(challengeGradient(i)[1]),
      )
    }
  })
})

describe('the challenge ink', () => {
  const CARD = '#FDFCFA'
  const SURFACE = '#F3EFE9'

  it('carries a word on both grounds, at every index', () => {
    // The reason this exists: the raw bright stop measures about 5.3:1 at the violet end
    // of the arc and about 3.4:1 at the magenta end, so a name drawn in it would be
    // readable for one challenge and under the bar for the next.
    for (const i of MANY) {
      const ink = challengeInk(challengeGradient(i)[1])
      expect(contrast(ink, CARD), `index ${i} on card (${ink})`).toBeGreaterThanOrEqual(
        4.5,
      )
      expect(
        contrast(ink, SURFACE),
        `index ${i} on surface (${ink})`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('stays the challenge’s own hue', () => {
    // Darkened, not greyed and not shifted: the ink has to still read as the colour on
    // the edge around it, or the card is wearing two colours rather than one.
    for (const i of MANY) {
      const stop = challengeGradient(i)[1]
      expect(apart(hueOf(challengeInk(stop)), hueOf(stop)), `index ${i}`).toBeLessThan(4)
    }
  })

  it('is never lighter than the stop it came from', () => {
    for (const i of MANY) {
      const stop = challengeGradient(i)[1]
      expect(relLum(challengeInk(stop)), `index ${i}`).toBeLessThanOrEqual(relLum(stop))
    }
  })

  it('returns a stop that already carries a word untouched', () => {
    // Not an optimisation — a correctness point. Taking a stop back to hue and saturation
    // and rebuilding it lands a channel or two one step out of 255, so a stop that was
    // already right would come back a hair off the hue the edge beside it is painted in.
    const violet = challengeGradient(0)[1]
    expect(challengeInk(violet)).toBe(violet)
  })

  it('darkens the stops that need it and leaves the rest where they are', () => {
    // Both halves of what the walk does, on the two ends of the arc. The violet end
    // already carries a word; the magenta end does not and has to come down for it.
    const violet = challengeGradient(0)[1]
    const magenta = challengeGradient(1)[1]
    expect(relLum(challengeInk(violet))).toBeCloseTo(relLum(violet), 2)
    expect(relLum(challengeInk(magenta))).toBeLessThan(relLum(magenta) * 0.7)
  })

  it('answers for a hand-picked stop too, not just a generated one', () => {
    // A challenge may name its own `gradient`. Deriving the ink from the stop rather than
    // from the catalog index is what makes that case work.
    for (const stop of ['#d651d3', '#51d6c0', '#ffe8a3', '#4C7EFF']) {
      const ink = challengeInk(stop)
      expect(contrast(ink, CARD), stop).toBeGreaterThanOrEqual(4.5)
      expect(apart(hueOf(ink), hueOf(stop)), stop).toBeLessThan(4)
    }
  })
})

describe('a challenge that names its own hue', () => {
  const CARD = '#FDFCFA'

  it('is built the same way as a generated one', () => {
    // Both stops from one hue, and the same near-black in front of each. The reason the
    // override is a hue rather than two hexes: a spec naming them separately could give
    // the edge one colour and the CTA another.
    const [edgeDark, edgeBright] = challengePairFor(TURQUOISE)
    const [ctaDark, ctaBright] = challengeDarkPairFor(TURQUOISE)
    expect(edgeDark).toBe(challengeGradient(0)[0])
    expect(ctaDark).toBe(challengeDarkGradient(0)[0])
    expect(hueOf(edgeBright)).toBeCloseTo(TURQUOISE, 0)
    expect(hueOf(ctaBright)).toBeCloseTo(TURQUOISE, 0)
  })

  it('leaves the generated arc alone', () => {
    // An override is somebody's decision; the sequence must not wander into the same
    // neighbourhood on its own. The arc still refuses this whole region — the collision
    // test further up holds it.
    expect(TURQUOISE).toBeLessThan(CHALLENGE_ARC.from)
  })

  it('keeps its distance from the two hues either side of it', () => {
    // The reason it moved to the blue end. Multiplayer's teal is 175° and trainee's blue
    // is about 222°, and a named hue has to clear both by the same margin the generated
    // arc is held to — otherwise an override is a way of smuggling in exactly the
    // collision the arc exists to prevent.
    expect(apart(TURQUOISE, hueOf(MULTIPLAYER_GRADIENT.accuracy[0]))).toBeGreaterThan(10)
    for (const mode of allModes().filter((m) => m.window === null)) {
      for (const stop of [...mode.gradient, ...mode.darkGradient]) {
        if (satOf(stop) <= 0.25) continue
        expect(apart(TURQUOISE, hueOf(stop)), `${mode.id} ${stop}`).toBeGreaterThan(10)
      }
    }
  })

  it('still ends up with a name a player can read', () => {
    // The hue's cost, and that it is paid. Turquoise at the palette's own lightness is
    // about 1.7:1 on the card — an intrinsically light hue — so the ink has to come well
    // down from the edge. Gold strikes the same bargain and for the same reason.
    const bright = challengePairFor(TURQUOISE)[1]
    expect(contrast(bright, CARD)).toBeLessThan(4.5)
    expect(contrast(challengeInk(bright), CARD)).toBeGreaterThanOrEqual(4.5)
    expect(apart(hueOf(challengeInk(bright)), TURQUOISE)).toBeLessThan(4)
  })

  it('is what four-keys actually wears', () => {
    const fourKeys = CHALLENGES.find((mode) => mode.id === 'challenge/four-keys')
    expect(fourKeys).toBeDefined()
    expect(fourKeys?.gradient).toEqual(challengePairFor(TURQUOISE))
    expect(fourKeys?.darkGradient).toEqual(challengeDarkPairFor(TURQUOISE))
  })

  it('carries white on its CTA, as every challenge must', () => {
    expect(contrast('#ffffff', challengeDarkPairFor(TURQUOISE)[1])).toBeGreaterThan(4.5)
  })
})

// ─── The drill's discs ───────────────────────────────────────────────────────

describe('the tints a drilled challenge draws its targets on', () => {
  // The lightest ground the app draws a target on. A tint has to carry the near-black
  // numeral on top of it everywhere the band tints already do.
  const CARD_FLOOR = 4.5

  it('gives every card of a drill a colour of its own', () => {
    const tints = challengeTints(challengeHue(2), 9)
    expect(tints).toHaveLength(9)
    expect(new Set(tints).size).toBe(9)
  })

  it('carries the numeral, as the band tints it stands in for do', () => {
    // Walked across the whole arc rather than one challenge's hue: a tint too dark at
    // one end of it would be a number nobody can read on exactly one challenge.
    for (let index = 0; index < 24; index++) {
      for (const tint of challengeTints(challengeHue(index), 9)) {
        expect(
          contrast(PRIMARY_INK, tint),
          `index ${index} (${tint})`,
        ).toBeGreaterThanOrEqual(CARD_FLOOR)
      }
    }
  })

  it("keeps every card inside its challenge's own family", () => {
    // Nine different colours that still read as one challenge, which is the whole
    // bargain — a drill spread across the wheel would be nine unrelated cards.
    const hue = challengeHue(2)
    for (const tint of challengeTints(hue, 9)) {
      expect(apart(hueOf(tint), hue)).toBeLessThanOrEqual(90)
    }
  })

  it('does not step its neighbours one at a time', () => {
    // Adjacent indices walk to opposite sides of the hue, so the three or four on the
    // board together are plainly different rather than three steps of one drift.
    const tints = challengeTints(challengeHue(2), 9)
    const first = tints[0]
    const second = tints[1]
    const third = tints[2]
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('a drill of nine has a first three')
    }
    expect(apart(hueOf(second), hueOf(third))).toBeGreaterThan(
      apart(hueOf(first), hueOf(second)),
    )
  })

  it('answers for a drill of one without dividing by nothing', () => {
    expect(challengeTints(challengeHue(0), 1)).toHaveLength(1)
  })
})

describe('the meter ink', () => {
  // The analytics breakdown draws a bar per mode × rung. A challenge's gradient starts on
  // the shared near-black, so its easy rung must not be the bar's colour.
  it('never draws a challenge in the near-black, at any rung', () => {
    for (const { id } of CHALLENGES) {
      for (const rung of ['easy', 'hard', 'extreme'] as const) {
        expect(meterInkOf(id, rung)).not.toBe(PRIMARY_INK)
      }
    }
  })

  it('tells two challenges apart', () => {
    const inks = new Set(CHALLENGES.map(({ id }) => meterInkOf(id, 'easy')))
    expect(inks.size).toBe(CHALLENGES.length)
  })

  it("draws a board's rung where the selectors do", () => {
    expect(meterInkOf('accuracy', 'hard')).toBe(getDifficultyColor('accuracy', 'hard'))
  })
})
