// The hero: a torch looked down on, as a path that is drawn out behind.
//
// The map is in plan, so the flame is too. A flame seen from above has no up and no lean —
// what it has is a direction it is being drawn out in, which is the direction the hero came
// from. Standing still it is a disc; under way it is a tongue.
//
// The one rule the shape keeps is that **length is a translation, not a scale**. Every point
// on the trailing half is pushed along the tail by how far behind it lies, and the radius is
// left alone — so a running flame is exactly as wide as a standing one and only ever longer.
// Scaling the radius instead was the first try, and a radius that grows at the back grows at
// the sides too: the flame swelled when it should have stretched.
//
// Built on the UI thread from `animatedProps`, which is why this is a string builder with a
// worklet directive rather than a component.
//
// Above its callers, not below: the worklet transform rewrites every function in here into a
// `const`, so a forward reference that would have hoisted throws on the way in.

const TAU = Math.PI * 2

// How many points the outline is sampled at. The flame is some thirty points across, so this
// puts a vertex every couple of points — finer than the ruffle it has to carry.
const POINTS = 40

// The ruffle: three harmonics, each shallower and faster than the one before, as a fraction
// of the radius and in milliseconds. One sine is a pulse and two is a wobble; three that
// share no period read as a flame.
const RUFFLE_A = 0.05
const RUFFLE_B = 0.03
const RUFFLE_C = 0.017
const RUFFLE_A_MS = 128
const RUFFLE_B_MS = 83
const RUFFLE_C_MS = 59

// How long the ruffle takes to travel once round the outline. This is what makes it read as
// a ripple running through the edge rather than as the whole shape breathing.
const SPIN_MS = 820

// How much the trailing end narrows and the leading edge flattens once the flame is fully
// drawn out. Small on purpose: enough to end in a point rather than a blunt cap.
const TAPER = 0.26
const FLATTEN = 0.1

// Paths are rebuilt every frame and handed to native as strings, so coordinates are trimmed
// to a tenth of a point — finer than any screen resolves, and a good third shorter.
function trim(value: number): number {
  'worklet'
  return Math.round(value * 10) / 10
}

// One coat of the flare, as a closed path around (0, 0).
//
// `tail` is the direction the flame is drawn out in, in radians. `length` is how far the
// trailing half is pushed along it, in points. `grain` scales the ruffle's angular frequency
// and `amp` its depth, which is what lets the coats of one flame differ: the outermost is
// ruffled finely and barely visible, the innermost is small and nearly smooth.
export function tonguePath(
  radius: number,
  tail: number,
  length: number,
  clockMs: number,
  grain: number,
  amp: number,
): string {
  'worklet'
  const spin = clockMs / SPIN_MS
  // How far through its stretch the shape is, which is what the taper is measured against —
  // a flame drawn out by less than its own width has barely any trailing end to narrow.
  const pull = radius > 0 ? Math.min(1, length / (radius * 2)) : 1
  const tx = Math.cos(tail)
  const ty = Math.sin(tail)
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const angle = (i / POINTS) * TAU
    const lean = Math.cos(angle - tail)
    const back = Math.max(0, lean)
    const front = Math.max(0, -lean)
    const ruffle =
      1 +
      amp *
        (RUFFLE_A * Math.sin(grain * 4 * angle + clockMs / RUFFLE_A_MS + spin) +
          RUFFLE_B * Math.sin(grain * 7 * angle - clockMs / RUFFLE_B_MS) +
          RUFFLE_C * Math.sin(grain * 11 * angle + clockMs / RUFFLE_C_MS - spin))
    const r = radius * ruffle * (1 - TAPER * back * pull - FLATTEN * front * pull)
    const x = Math.cos(angle) * r + tx * length * back
    const y = Math.sin(angle) * r + ty * length * back
    d += `${i === 0 ? 'M' : 'L'}${trim(x)} ${trim(y)}`
  }
  return `${d}Z`
}
