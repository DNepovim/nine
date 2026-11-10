import { insetLine, shotLine, type Point } from '@/lib/strike-shot'

// The footprints a **steps** shot leaves: the prints between two targets, and how faint a leg
// has grown by the time later ones lie over it. Pure, so the drawing only places what this says.

// How far apart two prints on one leg stand, along its line, and how far each stands off the
// line to its side — left and right alternate, which is what makes a line of marks read as steps.
export const STRIDE = 50
const SIDE = 11

// A leg stays on the floor for the run, and the oldest fade rather than leave: nine legs over
// the dial would hide the keys, and a floor wiped clean would lose the choreography.
const FADE_PER_LEG = 0.12
const FLOOR_OPACITY = 0.18

export type Side = 1 | -1

export type Print = {
  x: number
  y: number
  // Degrees, the way the foot points — along the leg.
  angle: number
  side: Side
  // How far along the leg this print stands, nought to one, so the drawing can land them in order.
  at: number
}

// The prints of one leg from `from` to `to`, kept `startGap` clear of the first card and `endGap`
// of the second, as a beam is. The first print stands on `firstSide`.
export function printsOf(
  from: Point,
  to: Point,
  startGap: number,
  endGap: number,
  firstSide: Side,
): Print[] {
  const line = shotLine(from, to)
  const { offset, length } = insetLine(line.length, startGap, endGap)
  const count = Math.max(1, Math.floor(length / STRIDE))
  const radians = (line.angle * Math.PI) / 180
  const along = { x: Math.cos(radians), y: Math.sin(radians) }
  return Array.from({ length: count }, (_, index) => {
    const at = (index + 0.5) / count
    const side: Side = index % 2 === 0 ? firstSide : firstSide === 1 ? -1 : 1
    const distance = offset + at * length
    return {
      x: from.x + along.x * distance - along.y * SIDE * side,
      y: from.y + along.y * distance + along.x * SIDE * side,
      angle: line.angle,
      side,
      at,
    }
  })
}

// How solid a leg is drawn once `age` legs have been laid after it.
export const legOpacity = (age: number): number =>
  Math.max(FLOOR_OPACITY, 1 - age * FADE_PER_LEG)
