import { mixHex } from '@/lib/mix-hex'

// A lump of lava-lamp wax, as an outline and a colour: DRIFT's `blobs` target form.
//
// The outline is a closed curve through a ring of points, each of which breathes on a rhythm of
// its own, so the wax swells where its neighbour pinches and no two lumps are ever in step. A
// **rising** number draws its head up — the points at the top are pushed out and the ones at the
// foot drawn in, a teardrop climbing — and a **falling** one the other way up. How much of either
// it does is `life`: nought is a round lump standing still, which is a target in the first second
// of its ring, before its number has moved; one is the wax as it runs.
//
// Pure and worklet-safe, so a card can redraw its path on the UI thread a frame at a time.

// How many points the ring has. Six is the fewest that still reads as wax rather than a polygon
// with its corners rounded, and the most that a path rebuilt every frame is cheap for.
export const WAX_POINTS = 6

// How far a point swings from its radius as it breathes, as a share of that radius.
const BREATH = 0.17
// How much longer the head is than the radius it grows from, on a target at full stretch.
const STRETCH = 0.3
// How fast the points breathe, in radians a second, and how far apart in time their rhythms sit.
// Slow: wax is not water.
const BREATH_RATE = 1.1
const BREATH_SPREAD = 1.9

export type WaxPoint = { x: number; y: number }

type WaxShape = {
  // The centre and the radius it is round at, in px.
  cx: number
  cy: number
  radius: number
  // Seconds of the card's own clock, and a phase that is this card's alone.
  time: number
  phase: number
  // Which way its number drifts: 1 rising, −1 falling, 0 not at all.
  heading: -1 | 0 | 1
  // How much of the wax's life it has, nought to one.
  life: number
}

export function waxPoints({
  cx,
  cy,
  radius,
  time,
  phase,
  heading,
  life,
}: WaxShape): WaxPoint[] {
  'worklet'
  const held = Math.min(1, Math.max(0, life))
  return Array.from({ length: WAX_POINTS }, (_, k) => {
    const angle = (2 * Math.PI * k) / WAX_POINTS
    const breath = Math.sin(time * BREATH_RATE + phase + k * BREATH_SPREAD)
    // Up the screen is a negative y, so `-sin` is how far toward the top a point sits: one at the
    // very top, minus one at the foot.
    const height = -Math.sin(angle)
    const reach = 1 + held * (BREATH * breath + heading * STRETCH * height)
    return {
      x: cx + Math.cos(angle) * radius * reach,
      y: cy + Math.sin(angle) * radius * reach,
    }
  })
}

const at = (n: number): string => n.toFixed(2)

// A smooth closed path through the points: each segment a cubic whose handles are a sixth of the
// way along the chord between the points either side of its ends (a Catmull-Rom spline), which is
// what keeps the outline round through every point instead of pinched at it.
export function waxPath(points: readonly WaxPoint[]): string {
  'worklet'
  const n = points.length
  let d = ''
  for (let k = 0; k < n; k++) {
    const p0 = points[(k + n - 1) % n]
    const p1 = points[k]
    const p2 = points[(k + 1) % n]
    const p3 = points[(k + 2) % n]
    if (!p0 || !p1 || !p2 || !p3) return ''
    if (k === 0) d += `M${at(p1.x)} ${at(p1.y)}`
    d +=
      `C${at(p1.x + (p2.x - p0.x) / 6)} ${at(p1.y + (p2.y - p0.y) / 6)}` +
      ` ${at(p2.x - (p3.x - p1.x) / 6)} ${at(p2.y - (p3.y - p1.y) / 6)}` +
      ` ${at(p2.x)} ${at(p2.y)}`
  }
  return `${d}Z`
}

// Where a number sits on the scale from the wax's cool end to its hot one, nought to one. Clamped
// rather than wrapped: a number that drifts past the ceiling the card was measured against is
// simply as hot as the wax gets.
export function waxHeat(value: number, ceiling: number): number {
  'worklet'
  if (ceiling <= 0) return 0
  return Math.min(1, Math.max(0, value / ceiling))
}

// The wax's colour at a number: the purple end of the scale at nothing, the pink end at the ceiling.
export function waxColor(
  value: number,
  ceiling: number,
  cool: string,
  hot: string,
): string {
  'worklet'
  return mixHex(cool, hot, waxHeat(value, ceiling))
}
