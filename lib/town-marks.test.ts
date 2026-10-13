import { describe, expect, it } from 'vitest'

import { CLOCK_RING, TOWN_BOX, townMarks, type TownDrawing } from '@/lib/town-marks'

type P = { x: number; y: number }

// How finely a curve or a straight run is walked. A sampled point every eighth is enough for
// what these tests ask — how far a mark reaches, and how near the middle it comes — and the
// nearest point of a wall to the middle is as often halfway along it as it is at either end.
const STEPS = 8

const along = (from: P, to: P, out: P[]): void => {
  for (let s = 1; s < STEPS; s++) {
    out.push({
      x: from.x + ((to.x - from.x) * s) / STEPS,
      y: from.y + ((to.y - from.y) * s) / STEPS,
    })
  }
}

const quadThrough = (from: P, c: P, to: P, out: P[]): void => {
  for (let s = 1; s < STEPS; s++) {
    const t = s / STEPS
    const u = 1 - t
    out.push({
      x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
    })
  }
}

// The arc, from its two ends and its radius — the endpoint parameterisation SVG uses, with
// rx === ry throughout this hand. Sampled, because the furthest point of an arc from
// anything is never one of its ends.
const arcThrough = (
  from: P,
  r: number,
  large: number,
  sweep: number,
  to: P,
  out: P[],
): void => {
  const hx = (from.x - to.x) / 2
  const hy = (from.y - to.y) / 2
  const span = hx * hx + hy * hy
  const lift = Math.sqrt(Math.max(0, r * r - span) / span) * (large === sweep ? -1 : 1)
  const c = { x: lift * hy + (from.x + to.x) / 2, y: -lift * hx + (from.y + to.y) / 2 }
  const at = Math.atan2(from.y - c.y, from.x - c.x)
  let turn = Math.atan2(to.y - c.y, to.x - c.x) - at
  if (sweep === 1 && turn < 0) turn += Math.PI * 2
  if (sweep === 0 && turn > 0) turn -= Math.PI * 2
  for (let s = 1; s <= 16; s++) {
    const a = at + (turn * s) / 16
    out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r })
  }
}

// A path back into points, so the drawing can be measured rather than eyeballed. Handles
// exactly what the hand emits: lines, the gate's one quadratic, and the arcs every disc is
// built out of.
function points(d: string): P[] {
  const tokens = d.match(/[MLQAZ]|-?\d+(?:\.\d+)?/g) ?? []
  const out: P[] = []
  let at: P = { x: 0, y: 0 }
  let i = 0
  const num = (): number => Number(tokens[i++])
  const pair = (): P => ({ x: num(), y: num() })
  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (cmd === 'Z') continue
    if (cmd === 'M') {
      at = pair()
    } else if (cmd === 'L') {
      const to = pair()
      along(at, to, out)
      at = to
    } else if (cmd === 'Q') {
      const c = pair()
      const to = pair()
      quadThrough(at, c, to, out)
      at = to
    } else {
      const r = num()
      i += 2
      const large = num()
      const sweep = num()
      const to = pair()
      arcThrough(at, r, large, sweep, to, out)
      at = to
    }
    out.push(at)
  }
  return out
}

const every = (town: TownDrawing): { x: number; y: number }[] => [
  ...points(town.knockout),
  ...town.marks.flatMap((mark) => points(mark.body)),
  ...points(town.detail),
  ...(town.pennant === null ? [] : points(town.pennant)),
]

const SEEDS = [0, 1, 2, 3, 4, 5, 7, 11, 16, 23, 41, 100]

// Every village the hand can be asked for, for the two invariants that have to hold for all
// of them rather than for a few: a village is composed out of a seed, so a drawing that
// reached across the clock or off the edge of the box would do it on one seed in a hundred.
const ALL = Array.from({ length: 400 }, (_, i) => i)

describe('townMarks', () => {
  it('draws the same place twice for the same seed', () => {
    for (const seed of SEEDS) {
      for (const fortified of [false, true]) {
        expect(townMarks(seed, fortified)).toEqual(townMarks(seed, fortified))
      }
    }
  })

  it('draws a different place for a different seed', () => {
    for (const fortified of [false, true]) {
      const drawings = SEEDS.map((seed) => JSON.stringify(townMarks(seed, fortified)))
      expect(new Set(drawings).size).toBeGreaterThan(1)
    }
  })

  it('builds a village out of several buildings', () => {
    for (const seed of SEEDS) {
      const village = townMarks(seed, false)
      expect(village.marks.length).toBeGreaterThanOrEqual(4)
      expect(village.marks.length).toBeLessThanOrEqual(5)
      // And draws no outline round them: the clock is the only ring an open village has.
      expect(village.detail).toBe('')
    }
  })

  // The two cues a player reads across a fan, and the whole reason there are two drawings.
  it('flies a pennant over a walled village and nothing else', () => {
    for (const seed of SEEDS) {
      expect(townMarks(seed, true).pennant).not.toBeNull()
      expect(townMarks(seed, false).pennant).toBeNull()
    }
  })

  it('draws every line of an open village lighter than any line of a wall', () => {
    for (const seed of SEEDS) {
      const open = townMarks(seed, false).marks.map((mark) => mark.width)
      const walled = townMarks(seed, true).marks.map((mark) => mark.width)
      expect(Math.max(...open)).toBeLessThan(Math.min(...walled))
    }
  })

  // SVG clips what leaves the box, and a cropped roof or a flag with its top cut off reads
  // as a drawing error rather than as a village.
  it('keeps the whole drawing inside the box', () => {
    const reach = TOWN_BOX / 2 - 0.7
    for (const seed of ALL) {
      for (const fortified of [false, true]) {
        for (const p of every(townMarks(seed, fortified))) {
          expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThanOrEqual(reach)
        }
      }
    }
  })

  // The buildings stand around the clock, never across it: it drains inside them, and a
  // roof laid over it would take a bite out of the one mark that is the game speaking.
  it('keeps a village clear of the clock', () => {
    for (const seed of ALL) {
      for (const mark of townMarks(seed, false).marks) {
        for (const p of points(mark.body)) {
          expect(Math.hypot(p.x, p.y)).toBeGreaterThan(CLOCK_RING + 1)
        }
      }
    }
  })
})
