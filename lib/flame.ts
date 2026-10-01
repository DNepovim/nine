// The hero: a flame, as a path that leans.
//
// Two shapes on one clock — a body and a tongue inside it — each leaning on a pair of sines
// that do not share a period, so the flicker never repeats and never looks like a loop.
// Built on the UI thread from `animatedProps`, which is why it is a string builder with a
// worklet directive rather than a component.
//
// Above its callers, not below: the worklet transform rewrites every function in here into
// a `const`, so a forward reference that would have hoisted throws on the way in.

// How far the flame leans, as a fraction of its width, and the two periods it leans on.
const LEAN = 0.22
const SLOW = 150
const FAST = 97
// How much its height breathes, and over what.
const BREATHE = 0.12
const BREATH_MS = 190

// Where the flame is leaning at a moment. Two sines rather than one: a single sine is a
// pendulum, and a fire is not a pendulum.
export function flameLean(clockMs: number): number {
  'worklet'
  return Math.sin(clockMs / SLOW) * 0.5 + Math.sin(clockMs / FAST) * 0.3
}

// The flame as a closed path, rising from (0, 0). `inner` draws the lighter tongue inside
// the body — the same shape, leaning further and reaching less far.
export function flamePath(size: number, clockMs: number, inner: boolean): string {
  'worklet'
  const k = flameLean(clockMs)
  const lean = k * size * LEAN * (inner ? 1.6 : 1)
  const tall = size * (1 + Math.sin(clockMs / BREATH_MS) * BREATHE) * (inner ? 1.25 : 1.9)
  const wide = size * (inner ? 0.16 : 0.42)
  const foot = inner ? -size * 0.1 : 0
  return (
    `M${-wide} ${foot}` +
    ` Q${-wide * 1.2 + lean} ${-tall * 0.6} ${lean * 1.4} ${-tall}` +
    ` Q${wide * 1.2 + lean} ${-tall * 0.6} ${wide} ${foot}` +
    ' Z'
  )
}
