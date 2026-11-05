// The shapes of NO SLIP's heart monitor, as plain numbers: one beat of a trace, a run of them,
// and the jagged mess of a heart that is not beating. Derived from a seed or from nothing at
// all, so the trace is the same trace whichever screen draws it — the opening's and the
// remains' meet without a beat jumping.

import { seeded } from '@/lib/storm'

export type TracePoint = { x: number; y: number }

// How wide one beat is, in px, and how far apart its points are sampled.
export const BEAT_WIDTH = 240
export const BEAT_STEP = 3

// The waves of a beat — P, Q, R, S, T — as a bump each: where it stands along the beat, how
// wide it is and how tall, up being negative as on a screen.
const WAVES = [
  { at: 45, width: 10, rise: -8 },
  { at: 92, width: 3, rise: 7 },
  { at: 102, width: 3.2, rise: -52 },
  { at: 112, width: 3.5, rise: 16 },
  { at: 165, width: 16, rise: -14 },
] as const

const heightAt = (x: number): number =>
  WAVES.reduce(
    (sum, wave) => sum + wave.rise * Math.exp(-(((x - wave.at) / wave.width) ** 2)),
    0,
  )

// One beat of a trace: level at both ends, so a run of them has no seam.
export function beatPoints(): TracePoint[] {
  const points: TracePoint[] = []
  for (let x = 0; x <= BEAT_WIDTH; x += BEAT_STEP) points.push({ x, y: heightAt(x) })
  return points
}

const pathOf = (points: readonly TracePoint[], baseline: number): string =>
  points
    .map(
      ({ x, y }, index) =>
        `${index === 0 ? 'M' : 'L'}${Math.round(x * 10) / 10} ${Math.round((baseline + y) * 10) / 10}`,
    )
    .join(' ')

// A heart in fibrillation: a line across `span` that never settles, up and down by as much
// as `reach` at random from point to point.
export function fibrillationPath(
  seed: number,
  span: number,
  reach: number,
  baseline: number,
): string {
  const roll = seeded(seed)
  const points: TracePoint[] = []
  for (let x = 0; x <= span; x += 5) points.push({ x, y: (roll() * 2 - 1) * reach })
  return pathOf(points, baseline)
}

// How far a beating thing is zoomed at `phase` of the way round one beat, nought to one: two
// quick, smooth swells one after the other — lub-dub — and then a rest before the next pair.
const THROBS = [
  { start: 0, length: 0.2, rise: 0.07 },
  { start: 0.2, length: 0.2, rise: 0.05 },
] as const

export const heartbeatScale = (phase: number): number => {
  'worklet'
  let scale = 1
  for (const throb of THROBS) {
    const into = (phase - throb.start) / throb.length
    if (into >= 0 && into < 1) scale += throb.rise * Math.sin(Math.PI * into) ** 2
  }
  return scale
}
