import { wobble } from '@/lib/map-marks'

// The hand that draws a siege: a tower at whatever height it has been knocked to, and the
// stretch of wall it stands on.
//
// Here rather than in the components for the same reason lib/map-marks.ts is: this is a
// drawing, and a drawing is a pure function of what it is of. The components place the
// boxes and run the animations; everything about the *shape* is in this file, and so is
// everything that makes it look drawn rather than drafted.
//
// Nothing here is a rectangle. A tower leans, draws in toward its top and sits on an
// uneven foot; its merlons are not quite the same height as each other; the wall between
// two of them wavers along its whole length. That is the house style — see `wobble`, which
// every mountain and fir on the sheet is already drawn with — and the one rule it comes
// with is that the waver must be *seeded*: a line that re-rolled per frame would shimmer,
// and a tower that re-rolled as it was knocked down would writhe.

const n = (v: number): string => {
  'worklet'
  return (Math.round(v * 10) / 10).toString()
}

// ── towers ──────────────────────────────────────────────────────────────────

// The block, in map points, which the siege camera is twice into — so a tower is drawn at
// about 26 by 66 on the screen. Measured against town-mark.tsx rather than guessed: `WIDTH`
// is a little under two thirds of the town's own wall radius (20), and at this width six of
// them stand along a wall the width of the canvas with a bay of air apiece.
export const TOWER_WIDTH = 13
const FULL = 30
// What is left when the last hit lands. Enough that rubble still reads as *something a wall
// left behind* rather than as a tower nobody finished — and a little under half the standing
// height, which is the difference the silhouette has to carry.
const STUMP = 14

// How far the merlons stand proud of the top, and how far past the block the widest lean
// and the deepest break can carry. The second is what the box has to be padded by.
const MERLON = 3
export const TOWER_REACH = 2.5

// Where the crenellations fall across the top, as fractions of its width: three blocks of
// three with two gaps of two, which is exactly the thirteen points of the block. Doubled up
// at each step, because a merlon is a vertical face and a vertical face is two points at one
// x. The same ten fractions carry the ruin, so the one can be interpolated into the other.
const CROWN = [0, 3, 3, 5, 5, 8, 8, 10, 10, 13].map((u) => u / 13)
const STANDING = [1, 1, 0, 0, 1, 1, 0, 0, 1, 1]

// How deep the breaks in a flattened tower go, as a share of what the merlons stood proud
// by. Under them, and deliberately: a ruin is a stump that has been eaten into, and a top
// as jagged as the crenellations it replaced reads as a scribble rather than as rubble.
const BROKEN = 0.7

export type TowerHand = {
  // The foot, which is uneven, and the lean of each side.
  footL: number
  footR: number
  drawL: number
  drawR: number
  // The kink partway up each side, and how far up it is.
  kneeL: number
  kneeR: number
  kneeAt: number
  // The waver on each point of the crown, and how far each of them is eaten away when the
  // tower is rubble.
  crown: readonly number[]
  ruin: readonly number[]
  // Where the stone courses run, as fractions of the standing height, and which side of the
  // tower is in shade.
  courses: readonly number[]
  shade: number
}

// One tower's own hand, from its seed. Everything random about the drawing is rolled once,
// here, so the shape is the same shape every frame and every hit.
export function towerHand(seed: number): TowerHand {
  const rnd = wobble(seed)
  return {
    footL: rnd() * 1.4,
    footR: rnd() * 1.4,
    // Always inward, and barely: a tower that widened toward its top would read as a
    // mistake, and one that drew in by much would read as a chimney.
    drawL: 0.4 + (rnd() + 0.5) * 0.9,
    drawR: 0.4 + (rnd() + 0.5) * 0.9,
    kneeL: rnd() * 0.9,
    kneeR: rnd() * 0.9,
    kneeAt: 0.45 + (rnd() + 0.5) * 0.25,
    crown: CROWN.map(() => rnd() * 0.8),
    ruin: CROWN.map(() => (0.35 + (rnd() + 0.5) * 0.65) * MERLON * BROKEN),
    courses: [0.34 + rnd() * 0.08, 0.66 + rnd() * 0.08],
    shade: rnd() > 0 ? 1 : -1,
  }
}

// How tall the tower stands at a given height of its ruin, and how wide it is at the top.
// Both worklets: the silhouette is rebuilt on the UI thread for every frame of a hit.
const standsTo = (rise: number): number => {
  'worklet'
  return STUMP + (FULL - STUMP) * rise
}

// The tower as one closed path, from its foot up the left side, across the crown and down
// the right. One path rather than a block with a cap on it, so the tower and its merlons can
// never come apart by half a point at the join.
//
// `rise` is one at full height and nought at rubble, and it carries three things at once:
// the tower comes down, the merlons are knocked off it, and the clean crenellated top is
// eaten into the broken one. Two profiles over the same ten points is what lets the last of
// those be a interpolation rather than a second drawing swapped in.
export function towerBody(hand: TowerHand, rise: number): string {
  'worklet'
  const height = standsTo(rise)
  const left = -TOWER_WIDTH / 2
  const right = TOWER_WIDTH / 2
  const topL = left + hand.drawL
  const topR = right - hand.drawR
  const knee = height * hand.kneeAt

  let d = `M${n(left + hand.footL)} ${n(-hand.footL * 0.4)}`
  d += ` L${n(left + hand.drawL * (1 - hand.kneeAt) + hand.kneeL)} ${n(-knee)}`
  d += ` L${n(topL)} ${n(-height)}`
  for (let i = 0; i < CROWN.length; i++) {
    const u = CROWN[i] ?? 0
    const proud = (STANDING[i] ?? 0) * MERLON * rise
    const eaten = (hand.ruin[i] ?? 0) * (1 - rise)
    const waver = (hand.crown[i] ?? 0) * rise
    d += ` L${n(topL + u * (topR - topL))} ${n(-height - proud + eaten + waver)}`
  }
  d += ` L${n(topR)} ${n(-height)}`
  d += ` L${n(right - hand.drawR * (1 - hand.kneeAt) + hand.kneeR)} ${n(-knee)}`
  d += ` L${n(right - hand.footR)} ${n(-hand.footR * 0.4)} Z`
  return d
}

// The stone of it: a course or two running across the block, and a few strokes of hachure
// down whichever side the tower has in shade.
//
// Stroked and never filled, like every other detail on this map. Courses above whatever the
// tower has been knocked down to are left off rather than clipped — a line hanging in the
// air over a ruin is worse than a ruin with no courses on it.
export function towerDetail(hand: TowerHand, rise: number): string {
  'worklet'
  const height = standsTo(rise)
  const half = TOWER_WIDTH / 2
  let d = ''
  for (let i = 0; i < hand.courses.length; i++) {
    const at = (hand.courses[i] ?? 0) * FULL
    if (at > height - MERLON - 1) continue
    // Short of both edges, and never level: a course inked edge to edge would read as the
    // tower having been cut in two.
    const inset = 2.4 + (hand.crown[i] ?? 0)
    const tilt = (hand.crown[i + 3] ?? 0) * 0.9
    d += ` M${n(-half + inset)} ${n(-at - tilt)} L${n(half - inset)} ${n(-at + tilt)}`
  }
  // The shade: a few short ticks raked in from whichever side of the tower is the darker.
  // Well apart, and short — three long strokes end to end down one edge stop reading as
  // shading and start reading as a crack running the height of the tower.
  const edge = hand.shade * (half - 1.3)
  for (let i = 0; i < 3; i++) {
    const at = height * (0.26 + i * 0.22)
    if (at > height - MERLON - 1) continue
    d += ` M${n(edge)} ${n(-at)} L${n(edge - hand.shade * 3)} ${n(-at - 1.3)}`
  }
  return d.trim()
}

// ── the wall between them ───────────────────────────────────────────────────

// How far the wall stands proud of its own foot line, and how far its merlons stand proud of
// that. Shorter than a tower, so the towers read as towers and the wall as the wall between.
const WALL_HEIGHT = 22
const WALL_MERLON = 3
const WALL_BLOCK = 3
const WALL_GAP = 2

// How high the gate's arch springs before it turns over. Its width is the caller's, being
// the bay the towers left for it; the crown comes to that spring plus half that width, which
// has to stay under `WALL_HEIGHT` with wall to spare above it.
const SPRING = 6

// How long a stretch of wall each straight length of the drawing covers. Short enough that
// the arc of the wall reads as a curve and its waver as a hand, long enough that a wall the
// width of a canvas is not a hundred points of path.
const STEP = 6

export type Rampart = {
  // Filled with the ground's colour and then inked. The gate is a subpath wound into it, so
  // with an even-odd fill it is a hole: the country shows through the opening and the arch
  // is drawn by the one stroke the wall is.
  body: string
  // Stroked only: the courses of stone along it.
  detail: string
}

// The stretch of wall, drawn from the middle outward.
//
// `half` is how far it runs either side of the gate and `bow` is how far its ends stand back
// from its middle — the one thing saying the stretch is an arc of something much bigger than
// the screen. Both edges of the band follow that same arc, so the wall is the same height
// all the way along it rather than sagging to nothing in the middle.
export function rampartMarks(
  half: number,
  bow: number,
  gate: number,
  seed: number,
): Rampart {
  const rnd = wobble(seed)
  // The two lines of it, each wavering on its own: a wall whose edges wavered in step would
  // be a wall drawn with a ruler and then bent.
  const foot = (x: number): number => -bow * (x / half) * (x / half)
  const waver = (x: number): number => Math.sin(x * 0.21 + seed) * 0.45

  let body = `M${n(-half)} ${n(foot(-half))} L${n(-half)} ${n(foot(-half) - WALL_HEIGHT)}`
  // Along the crenellated top. The merlons are walked in map points rather than per bay, so
  // a block is the same block wherever the wall happens to run off the edge of the screen.
  for (let x = -half; x < half;) {
    const top = (at: number): number => foot(at) - WALL_HEIGHT + waver(at)
    const block = Math.min(x + WALL_BLOCK, half)
    const proud = WALL_MERLON + rnd() * 0.9
    body += ` L${n(x)} ${n(top(x) - proud)} L${n(block)} ${n(top(block) - proud)}`
    body += ` L${n(block)} ${n(top(block))}`
    if (block >= half) break
    const next = Math.min(block + WALL_GAP, half)
    body += ` L${n(next)} ${n(top(next))}`
    x = next
  }
  body += ` L${n(half)} ${n(foot(half))}`
  for (let x = half - STEP; x > -half; x -= STEP) {
    body += ` L${n(x)} ${n(foot(x) + waver(x) * 0.7)}`
  }
  body += ' Z'

  // The gate: an arch cut out of the middle of it.
  const jamb = gate / 2
  const sill = foot(0)
  body += ` M${n(-jamb)} ${n(sill)} L${n(-jamb)} ${n(sill - SPRING)}`
  body += ` A${n(jamb)} ${n(jamb)} 0 0 1 ${n(jamb)} ${n(sill - SPRING)}`
  body += ` L${n(jamb)} ${n(sill)} Z`

  // Courses of stone along it, in short dashes well apart rather than as a line — a wall
  // this long inked end to end reads as a rule under the merlons rather than as stonework,
  // and two such rules read as the contours of a hill. The gate is skipped: an arch is cut
  // through the wall and has no face to course.
  let detail = ''
  for (const share of [0.42, 0.74]) {
    const at = WALL_HEIGHT * share
    for (let x = -half + share * STEP; x < half; x += STEP * 3) {
      const to = Math.min(x + STEP * 0.9, half)
      if (to > -jamb - 2 && x < jamb + 2) continue
      detail += ` M${n(x)} ${n(foot(x) - at + waver(x))} L${n(to)} ${n(foot(to) - at + waver(to))}`
    }
  }
  return { body, detail: detail.trim() }
}

// How much room over the wall's own foot line the drawing takes: the merlons, the waver and
// the bow of its ends. What the box it is drawn in has to be made of.
export const rampartHeight = (bow: number): number => bow + WALL_HEIGHT + WALL_MERLON + 2
