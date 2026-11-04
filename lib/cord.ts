// A hanging cord's shape, for BLACKOUT's pull-cord: fixed at the top and free at the foot.
//
// Two movements laid over a straight line. The **sway** is the whole cord swinging from its
// fixing, so it grows towards the foot. The **wave** is what a pull leaves behind when it is
// let go: crests running up from the free end, dying away as they climb.
//
// Worklets, since the cord is redrawn on the UI thread every frame it moves.

// How far each movement carries the foot, in points.
const SWAY_REACH = 5
const WAVE_REACH = 9
// How many crests stand on the cord at once, and how many pass over a whole wave. A half at
// the end of `CRESTS` puts the sine at nought on the foot, so a wave starts from where the
// cord already stands.
const CRESTS = 2.5
const PASSES = 3
const POINTS = 20

// How far a point on the cord stands off its line. `along` runs nought at the fixing to one
// at the foot, `sway` from -1 to 1, and `wave` from nought when let go to one when spent.
export function cordOffset(along: number, sway: number, wave: number): number {
  'worklet'
  const swing = sway * SWAY_REACH * along
  if (wave >= 1) return swing
  const crest = Math.sin(2 * Math.PI * (CRESTS * along + PASSES * wave))
  return swing + WAVE_REACH * (1 - wave) * along * crest
}

// The cord as an SVG path, hanging `length` points down from the top at `center`.
export function cordPath(
  center: number,
  length: number,
  sway: number,
  wave: number,
): string {
  'worklet'
  let path = `M ${center} 0`
  for (let point = 1; point <= POINTS; point += 1) {
    const along = point / POINTS
    const x = center + cordOffset(along, sway, wave)
    path += ` L ${x.toFixed(2)} ${(along * length).toFixed(2)}`
  }
  return path
}
