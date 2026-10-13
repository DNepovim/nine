import { AMBUSH_ALONG, AMBUSH_AT, GROUND_MARGIN, GROUND_MIN } from '@/constants/ambush'
import { ANCHOR } from '@/constants/arcade'
import { FIELD_MIN, HERO_AT, SIEGE_ZOOM, SKY, WALL_AT } from '@/constants/siege'
import { tiltedAt, type Sheet } from '@/lib/arcade-tilt'
import { type ArcadeWay } from '@/machines/arcade'

// Arcade's geometry: a crossroad and its ways turned into points and curves, and the two
// worklets that draw one and ride along it.
//
// Every spline is in its own crossroad's frame — the crossroad is the origin and the way
// leaves it — so a way's shape never depends on where the run has got to. The screen places
// each crossroad's box and lets the curves inside it stay local. Points, not pitches:
// machines/arcade.ts holds the map in pitches, and this is the one place that knows how long
// a pitch is.

// How far along the way each control point sits. The near control leans along the way in and
// the far one along the way out, which is what makes two ways meeting at a crossroad read as
// one continuous line rather than as a corner.
const CONTROL = 0.42

// How many segments a length measurement samples. The length only has to be long enough to
// set a dash pattern that can cover the whole way, so a close answer is plenty.
const SAMPLES = 24

// One pitch, as a share of the canvas: how far apart two crossroads stand. A share rather
// than a fixed size, so the same fan fits the same way on a tall phone and a short one.
const PITCH = 0.4

// How far below the first crossroad the mouth hangs.
const STUB_REACH = 0.5

export type Point = { x: number; y: number }

export type Spline = {
  // Where the way ends, relative to the crossroad it leaves.
  toX: number
  toY: number
  c1x: number
  c1y: number
  c2x: number
  c2y: number
  // Roughly how long the curve is. The draw-on and the wither are measured against it: a
  // dash this long can hide the whole way.
  length: number
}

export const pitchFor = (canvasHeight: number): number => canvasHeight * PITCH

// How a siege is framed, worked out from the canvas and the way the hero came in on.
//
// Two answers, because the picture takes two things to make and neither is any use without
// the other: the camera has to lift the wall to the top of the canvas, and the hero has to
// stop far enough short of the gate that what lies between them is the whole of the ground
// below it. A lift on its own carries the hero off the bottom of the screen; a stand-off on
// its own leaves the fight in the middle of the sheet with empty country over it.
//
// The wall is the thing pinned, not the hero. A tower is drawn at a fixed size whatever the
// canvas is, so on a short screen `SKY` is what decides where the wall may stand and the
// ground is what gives — which is the right way round, a fight on a cramped screen being
// worth more than a tower with its merlons cut off.
export type SiegeFrame = {
  // What the camera adds to the sheet's own place, in screen points. Negative: the wall
  // stands above where the anchor alone would have put the village.
  lift: number
  // Where along the way in the hero stops, nought at the crossroad behind and one at the
  // gate. Worked out rather than named, because what has to come to a fixed figure is the
  // ground it leaves on the *screen*, and the ways are not all one length.
  standoff: number
}

// How close to either end of the way in the hero may be held. A short way on a tall screen
// would otherwise ask for a stand-off behind the crossroad it came from.
const HELD = 0.1

export function siegeFrame(canvasHeight: number, reach: number): SiegeFrame {
  const wallY = Math.max(canvasHeight * WALL_AT, SKY * SIEGE_ZOOM)
  const field = Math.max(FIELD_MIN, canvasHeight * HERO_AT - wallY)
  const chord = reach * pitchFor(canvasHeight)
  // The ground the field comes to in the frame the way is measured in: screen points back
  // through the siege camera, then as a share of the way's own length. Of the chord rather
  // than of the curve, which the hero's own stand-off reading is also taken on — a way
  // bends by a couple of points in the hundred and thirty it runs.
  const back = chord === 0 ? 0 : field / SIEGE_ZOOM / chord
  return {
    lift: wallY - canvasHeight * ANCHOR,
    standoff: Math.min(1 - HELD, Math.max(HELD, 1 - back)),
  }
}

// How an ambush is framed, worked out from the canvas and the way the hero is walking.
//
// Two answers like a siege's, and for a different reason in each case. A siege lifts a wall
// to the top of the canvas and leaves the ground under it; an ambush has no near side and no
// far one — the men come from every direction at once — so what the camera has to do is put
// the hero in the *middle* and leave as much room round it on every side as the canvas has.
//
// `lift` is what carries the hero there. The sheet puts the way's far village on the anchor
// as it always does, and the hero is standing short of it by however much of the way is
// left, drawn at the siege's own zoom; the lift is whatever it takes to move that point to
// `AMBUSH_AT`. Worked backwards from the hero rather than named, for the same reason a
// siege's stand-off is: the ways are not all one length, and what has to come out the same
// on the screen is the picture.
//
// `ground` is how far the furthest bandit stands, in map points. The lesser of the canvas's
// two half-dimensions, because the band is a circle and a circle fits inside the shorter
// side — through the zoom, since that is what the sheet is drawn under, and short of the
// edge by the room a man and his number need.
export type AmbushFrame = {
  lift: number
  // Where along the way the hero stops. A fixed share rather than a worked-out one: what has
  // to be constant here is the ring round the hero, which the ground answers for, and the
  // spring point is free to be the same fraction of every way.
  standoff: number
  ground: number
}

export function ambushFrame(
  canvasWidth: number,
  canvasHeight: number,
  reach: number,
): AmbushFrame {
  const short = Math.min(canvasWidth, canvasHeight)
  const left = (1 - AMBUSH_ALONG) * reach * pitchFor(canvasHeight) * SIEGE_ZOOM
  return {
    lift: canvasHeight * AMBUSH_AT - canvasHeight * ANCHOR - left,
    standoff: AMBUSH_ALONG,
    ground: Math.max(GROUND_MIN, short / 2 / SIEGE_ZOOM - GROUND_MARGIN),
  }
}

// Above its callers rather than below them: the worklet transform rewrites every function in
// here into a `const`, so a forward reference that would have hoisted throws on the way in.
//
// The curve always starts at the crossroad, so the first term of the cubic is zero and is
// left out.
function bezierAt(s: Omit<Spline, 'length'>, t: number): Point {
  'worklet'
  const u = 1 - t
  const near = 3 * u * u * t
  const far = 3 * u * t * t
  const end = t * t * t
  return {
    x: near * s.c1x + far * s.c2x + end * s.toX,
    y: near * s.c1y + far * s.c2y + end * s.toY,
  }
}

// The way as an SVG path, drawn where the tilt puts it. A way is a road on a map and holds
// still; what moves it is the camera, and nothing else. Built on the UI thread all the same,
// because the camera is a shared value and a way has to be redrawn under it whatever React
// is doing.
//
// `cx`/`cy` say where the crossroad sits inside the box the path is drawn in — the curve is
// measured from the crossroad, and the box has to put that origin somewhere all of its ways
// fit around. `x`/`y` say where that crossroad is on the sheet, which is what the tilt needs
// to know: the box itself is carried to the crossroad's own drawn place by the view it is in,
// and what is measured in here is the curve off that place.
//
// The four points of the cubic are projected one at a time, and that makes a way the one mark
// on this sheet allowed to come out distorted. It has to be: a way is a line between two
// towns, both of its ends are placed by the tilt, so a way running up the map must be drawn
// short enough that its tip is still the point its town was drawn to. What it costs is a
// curve that is no longer exactly the curve the spline describes — a couple of points over
// the hundred and thirty a way runs.
export function splinePath(
  s: Spline,
  cx: number,
  cy: number,
  sheet: Sheet,
  x: number,
  y: number,
): string {
  'worklet'
  const root = tiltedAt(sheet, x, y)
  const c1 = tiltedAt(sheet, x + s.c1x, y + s.c1y)
  const c2 = tiltedAt(sheet, x + s.c2x, y + s.c2y)
  const end = tiltedAt(sheet, x + s.toX, y + s.toY)
  // Off the crossroad's drawn place rather than off where it was laid out, the box having
  // been carried there already.
  const ox = cx - root.x
  const oy = cy - root.y
  return (
    `M${cx} ${cy} C${ox + c1.x} ${oy + c1.y} ` +
    `${ox + c2.x} ${oy + c2.y} ${ox + end.x} ${oy + end.y}`
  )
}

// Where on the way the hero is: the same curve the way is drawn from, so it rides the line
// rather than crossing it.
export function splinePoint(s: Spline, t: number): Point {
  'worklet'
  return bezierAt(s, t)
}

// Roughly how long a curve is.
function splineLength(s: Omit<Spline, 'length'>): number {
  let total = 0
  let prev: Point = { x: 0, y: 0 }
  for (let i = 1; i <= SAMPLES; i++) {
    const at = bezierAt(s, i / SAMPLES)
    total += Math.hypot(at.x - prev.x, at.y - prev.y)
    prev = at
  }
  return total
}

// The spline for a way out of a crossroad that the way in arrived at on `heading`.
export function splineFor(way: ArcadeWay, heading: number, pitch: number): Spline {
  const d = pitch * way.reach
  const toX = Math.cos(way.angle) * d
  const toY = Math.sin(way.angle) * d
  const shape = {
    toX,
    toY,
    c1x: Math.cos(heading) * d * CONTROL,
    c1y: Math.sin(heading) * d * CONTROL,
    c2x: toX - Math.cos(way.angle) * d * CONTROL,
    c2y: toY - Math.sin(way.angle) * d * CONTROL,
  }
  // The length is of the curve, so it can only be measured once the curve exists.
  return { ...shape, length: splineLength(shape) }
}

// The stub the mouth hangs on: a short way straight down out of the first crossroad, ending
// in the ring a lost run falls into.
//
// It exists because the clock is drawn on the way *behind* the hero, and at the first
// crossroad there is no way behind. So the first crossroad is given one — and it is also what
// the hero rides down when that clock wins, which turns the one place the model was short
// into the one place the clock says exactly what it costs.
export function mouthStub(pitch: number): Spline {
  const down = Math.PI / 2
  return splineFor(
    { to: 'mouth', angle: down, reach: STUB_REACH, value: 0, clockMs: 11000 },
    down,
    pitch,
  )
}

// A crossroad's place on the canvas, in points.
//
// Measured from where the run began and never re-based, which is the one decision the whole
// screen rests on: the camera is a shared value and the map is React state, so if positions
// were relative to wherever the hero is now, every arrival would have to shift the map and
// reset the camera by the same vector in the same frame. In one fixed frame an arrival moves
// nothing that is already drawn, and the two can never tear.
export const pointsOf = (pos: Point, pitch: number): Point => ({
  x: pos.x * pitch,
  y: pos.y * pitch,
})
