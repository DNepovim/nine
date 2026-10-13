import { BUD_SIZE } from '@/constants/arcade'
import { wobble } from '@/lib/map-marks'

// The hand that draws a settlement at a way's end: an open village, or a walled one.
//
// Here rather than in the component for the same reason lib/map-marks.ts and
// lib/siege-marks.ts are: this is a drawing, and a drawing is a pure function of what it is
// of. The component places the box, puts the inks to it and hangs the clock and the number
// inside it; everything about the *shape* is in this file.
//
// Two marks with nothing in common, which is the whole point of the pair. A player choosing
// a way is choosing whether to walk into a place or to fight for it, and that has to be
// legible across a fan at a glance, under a clock, with no second village beside it to
// compare against:
//
//   open village   no wall and no outline at all — a handful of buildings standing round
//                  the number, and the clock the only ring on it.
//   walled village one heavy ring, crenellated the whole way round, with a round tower at
//                  each quarter, a gate at the foot and a pennant flying above it.
//
// So the two differ before anything is read: one is a ring of ink, the other is a cluster of
// roofs with open ground between them. Nothing has to be compared with anything.
//
// A village is composed rather than drawn: six places to build, four or five of them built
// on, and a church, a town hall, cottages, a barn and a tall town house to build there. All
// of it off the crossroad's own seed, so a place is the same place every frame and no two in
// sight of each other are the same village.
//
// Everything is drawn about the middle of the box, which is the point the number sits on and
// the point the sheet's turn is taken back about.

// The box has to hold the ground the number sits on and whatever stands outside it: the
// merlons, towers and pennant of a wall, or a church with its spire up.
export const TOWN_BOX = BUD_SIZE + 20

// The ground the number sits on, which both settlements clear the same amount of: a walled
// village inks a wall round it, an open one leaves it open.
const RING = BUD_SIZE / 2 - 1

// Where the clock is drawn — see components/game/village-clock.tsx, which takes it from
// here. On an open village it is the only ring there is, and on both it is the one circle
// that is the game speaking rather than the map, so the hand's job is to keep every other
// line off it.
export const CLOCK_RING = RING - 3.5

// How close to the middle anything may be built. Outside the clock with air to spare: a roof
// laid over a countdown would take a bite out of the one mark a player is reading time off.
const CLEAR = CLOCK_RING + 1.5

// Where a place's name hangs, as a drop from the middle of the mark. Under the lowest thing
// the settlement reaches, and a figure per kind rather than per village — the names across
// a fan have to sit at one height, whichever of its six places this village built on.
export const NAME_BELOW = { open: 32, walled: 27 } as const

// Which of the map's two inks a mark is drawn in: the strong one a settlement is inked with,
// or the fainter one its details are.
type Ink = 'line' | 'hatch'

export type TownDrawing = {
  // The ground, filled with the surface colour and never inked. It is what makes the number
  // legible over whatever country the mark happens to stand on, and on an open village it is
  // the whole of the outline — which is to say there is none.
  knockout: string
  // Back to front. Each one is filled with the ground's colour and then inked before the
  // next is begun, which is the whole of how a tower stands in front of the wall it is built
  // into and how the near end of a village stands in front of its far end.
  marks: readonly { body: string; width: number; ink: Ink }[]
  // Stroked only, in the fainter ink: the gate of a wall. Empty on an open village.
  detail: string
  // Flown over a walled village and nothing else, filled solid in the map's own ink.
  pennant: string | null
}

const n = (v: number): string => (Math.round(v * 10) / 10).toString()

// A circle as a path, so every piece of a settlement is the same kind of thing. Two half
// arcs, which stays exact — the clock is drawn concentric with the ground and would show up
// a circle built out of curves.
const disc = (cx: number, cy: number, r: number): string =>
  `M${n(cx - r)} ${n(cy)} A${n(r)} ${n(r)} 0 1 1 ${n(cx + r)} ${n(cy)} ` +
  `A${n(r)} ${n(r)} 0 1 1 ${n(cx - r)} ${n(cy)} Z`

// A rectangle standing on `base`, which is what every wall of every building in here is.
const block = (x: number, base: number, half: number, height: number): string =>
  `M${n(x - half)} ${n(base)} L${n(x - half)} ${n(base - height)} ` +
  `L${n(x + half)} ${n(base - height)} L${n(x + half)} ${n(base)} Z `

// A gable: the triangle of a roof seen end on, oversailing the walls it sits on.
const gable = (x: number, eaves: number, half: number, rise: number): string =>
  `M${n(x - half)} ${n(eaves)} L${n(x)} ${n(eaves - rise)} ` +
  `L${n(x + half)} ${n(eaves)} Z `

// A hip: the same roof with its ridge cut back to a short flat top, which is how a building
// of any importance is roofed and so what tells a hall from a house.
const hip = (x: number, eaves: number, half: number, rise: number): string =>
  `M${n(x - half)} ${n(eaves)} L${n(x - half * 0.42)} ${n(eaves - rise)} ` +
  `L${n(x + half * 0.42)} ${n(eaves - rise)} L${n(x + half)} ${n(eaves)} Z `

// ── what a village is built of ──────────────────────────────────────────────

// One building, rolled but not yet placed: how far it reaches either side and how tall it
// stands, and the hand that will draw it once the village knows where it goes.
//
// Rolled first and placed second because where it can stand depends on how big it is — a
// church with its spire up has to be set further out than a barn, or it would reach across
// the clock.
type Shape = {
  half: number
  height: number
  draw: (x: number, base: number) => string
}

// Every building is drawn as subpaths of one path, filled with the ground's colour and then
// inked in one pass. Where two of them meet — a tower against a nave, a turret on a roof —
// the line between stays, which is what a building drawn by a hand looks like: a thing put
// together out of parts, not a silhouette.

function cottage(rnd: () => number): Shape {
  const half = 3.6 + rnd() * 0.8
  const wall = 3.1 + rnd() * 0.7
  const rise = 3.4 + rnd() * 0.9
  const over = 1.2
  return {
    half: half + over,
    height: wall + rise,
    draw: (x, base) =>
      block(x, base, half, wall) + gable(x, base - wall, half + over, rise),
  }
}

// Long and low, and the one building a village has that is not lived in.
function barn(rnd: () => number): Shape {
  const half = 5 + rnd() * 1.2
  const wall = 2.6 + rnd() * 0.5
  const rise = 2.5 + rnd() * 0.6
  const over = 1.4
  return {
    half: half + over,
    height: wall + rise,
    draw: (x, base) =>
      block(x, base, half, wall) + gable(x, base - wall, half + over, rise),
  }
}

// A town house: narrow, two storeys and steep. What stands where the ground is worth
// something, which in a village of this size is next to the green.
function townHouse(rnd: () => number): Shape {
  const half = 3 + rnd() * 0.5
  const wall = 4.6 + rnd() * 1
  const rise = 3.2 + rnd() * 0.7
  const over = 1
  return {
    half: half + over,
    height: wall + rise,
    draw: (x, base) =>
      block(x, base, half, wall) + gable(x, base - wall, half + over, rise),
  }
}

// The church: a low nave with a tower at one end of it and a spire on the tower. The one
// building in the village taller than it is wide, and the one a map has always drawn even
// when it drew nothing else of a place.
function church(rnd: () => number): Shape {
  const nave = 4.4 + rnd() * 0.8
  const naveWall = 3 + rnd() * 0.5
  const naveRise = 2.8 + rnd() * 0.5
  const tower = 2.1
  const towerWall = 7 + rnd() * 1
  const spire = 3.4 + rnd() * 0.6
  // The tower stands at one end of the nave, east or west as the hand fell.
  const side = rnd() > 0 ? 1 : -1
  const half = nave + tower
  return {
    half,
    height: towerWall + spire,
    draw: (x, base) => {
      const naveX = x - side * tower
      const towerX = x + side * nave
      return (
        block(naveX, base, nave, naveWall) +
        gable(naveX, base - naveWall, nave + 0.7, naveRise) +
        block(towerX, base, tower, towerWall) +
        gable(towerX, base - towerWall, tower + 0.5, spire)
      )
    },
  }
}

// The town hall: wide, hipped, and carrying a turret in the middle of its roof. Nothing else
// in the village is symmetrical, which is most of how this reads as the one building the
// place put up on purpose.
function hall(rnd: () => number): Shape {
  const half = 4.6 + rnd() * 0.8
  const wall = 4.8 + rnd() * 0.8
  const rise = 2.4
  const turret = 1.2
  const turretWall = 2.4 + rnd() * 0.5
  const cap = 1.8
  return {
    half: half + 0.8,
    height: wall + rise + turretWall + cap,
    draw: (x, base) => {
      const eaves = base - wall
      const ridge = eaves - rise
      return (
        block(x, base, half, wall) +
        hip(x, eaves, half + 0.8, rise) +
        block(x, ridge, turret, turretWall) +
        gable(x, ridge - turretWall, turret + 0.4, cap)
      )
    },
  }
}

// ── composing one ───────────────────────────────────────────────────────────

// The six places a village may build on, and the ground they stand on. Six rather than four
// so a village reads as a scatter of buildings rather than as a pattern, and far enough
// apart at this radius that two of them touch at the corner at worst.
const SLOTS = 6
const GROUND = RING - 2

// How far out a building has to be pushed before it is clear of the clock. Solved rather
// than reasoned about: a church and a barn are nothing like the same size, and the answer
// also depends on which way round the slot has it standing.
const PUSH_STEP = 0.25
const PUSH_MAX = 60

// Where a building stands, given the slot it was given. Above the middle it stands with its
// foot on the ground circle and grows up and away; below, it is set down far enough that its
// roof comes up to that circle — either way nothing it is built of ever leans in over the
// number.
function stand(shape: Shape, angle: number): { x: number; base: number } {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const at = (radius: number) => {
    const x = dx * radius
    const y = dy * radius
    return { x, base: y > 0 ? y + shape.height : y }
  }
  // How near the middle this building would come, standing where it is: the distance from
  // the middle to the nearest point of the block it fills, which is as often a point along
  // one of its sides as it is a corner.
  const nearest = (p: { x: number; base: number }): number => {
    const outX = Math.max(p.x - shape.half, -p.x - shape.half, 0)
    const outY = Math.max(p.base - shape.height, -p.base, 0)
    return Math.hypot(outX, outY)
  }
  let radius = GROUND
  for (let i = 0; i < PUSH_MAX; i++) {
    if (nearest(at(radius)) >= CLEAR) break
    radius += PUSH_STEP
  }
  return at(radius)
}

// What stands in a village, in the order the slots are taken. A church more often than not,
// a hall now and then, and houses for the rest — a village is mostly houses, and the two
// buildings that are not are the two there is never more than one of.
function buildings(rnd: () => number): Shape[] {
  const built = rnd() > 0 ? 5 : 4
  const roll: (() => Shape)[] = []
  if (rnd() + 0.5 < 0.7) roll.push(() => church(rnd))
  if (rnd() + 0.5 < 0.45) roll.push(() => hall(rnd))
  while (roll.length < built) {
    const pick = rnd() + 0.5
    roll.push(
      pick < 0.52
        ? () => cottage(rnd)
        : pick < 0.78
          ? () => townHouse(rnd)
          : () => barn(rnd),
    )
  }
  // Shuffled, so the church is not always in the slot the first roll handed out.
  for (let i = roll.length - 1; i > 0; i--) {
    const j = Math.floor((rnd() + 0.5) * (i + 1))
    const swap = roll[i]
    roll[i] = roll[j] as () => Shape
    roll[j] = swap as () => Shape
  }
  return roll.map((make) => make())
}

// ── both ────────────────────────────────────────────────────────────────────

// The quarters of a wall, where its towers are built.
const QUARTERS = [1, 3, 5, 7].map((i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2
  return { x: Math.cos(a) * RING, y: Math.sin(a) * RING }
})

// How far a merlon stands off the wall, and how wide one is.
const MERLON = 2.6
const MERLON_HALF = 0.055

// The gate: a little arch at the foot of the wall, which is where a road would come in.
const GATE =
  `M-2.6 ${RING - 0.4} L-2.6 ${RING - 3.4} ` +
  `Q0 ${RING - 5.6} 2.6 ${RING - 3.4} L2.6 ${RING - 0.4}`

// The pennant, off the top of the north tower: a staff standing clear of the wall and a
// swallow-tailed flag on the windward side of it.
const STAFF = RING + 6
const PENNANT =
  `M0 ${-RING - 1} L0 ${-STAFF} ` +
  `L7 ${-STAFF + 2} L5 ${-STAFF + 3.1} L7 ${-STAFF + 4.2} L0 ${-STAFF + 5} Z`

// The crenellations, as one path: a block of wall standing proud at every step round it.
function merlons(count: number): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    const at = (radius: number, offset: number) => ({
      x: Math.cos(a + offset) * radius,
      y: Math.sin(a + offset) * radius,
    })
    const p1 = at(RING - 0.5, -MERLON_HALF)
    const p2 = at(RING + MERLON, -MERLON_HALF)
    const p3 = at(RING + MERLON, MERLON_HALF)
    const p4 = at(RING - 0.5, MERLON_HALF)
    d += `M${n(p1.x)} ${n(p1.y)} L${n(p2.x)} ${n(p2.y)} L${n(p3.x)} ${n(p3.y)} L${n(p4.x)} ${n(p4.y)} Z`
  }
  return d
}

// The settlement at a way's end, from the crossroad's own seed and whether it is held.
export function townMarks(seed: number, fortified: boolean): TownDrawing {
  const knockout = disc(0, 0, RING)

  if (fortified) {
    const rnd = wobble(seed)
    const count = 12 + Math.floor((rnd() + 0.5) * 3) * 2
    const tower = rnd() > 0 ? 3.9 : 3.1
    return {
      knockout,
      marks: [
        // The crenellations go on behind the wall, so the wall's own line runs unbroken
        // along the foot of them.
        { body: merlons(count), width: 1.3, ink: 'line' },
        { body: disc(0, 0, RING), width: 2.2, ink: 'line' },
        // And the towers in front of it, the way a tower is built: one boss at each
        // quarter, standing out of the wall on both sides of it.
        {
          body: QUARTERS.map((q) => disc(q.x, q.y, tower)).join(''),
          width: 1.4,
          ink: 'line',
        },
      ],
      detail: GATE,
      pennant: PENNANT,
    }
  }

  const rnd = wobble(seed)
  // Which of the six places this village built on, and which way round the ring they run.
  const turn = Math.floor((rnd() + 0.5) * SLOTS)
  const placed = buildings(rnd).map((shape, i) => {
    const angle = (((turn + i) % SLOTS) / SLOTS) * Math.PI * 2 - Math.PI / 2
    const at = stand(shape, angle)
    return { ...at, body: shape.draw(at.x, at.base) }
  })

  // Far end of the village first: a building nearer the reader stands in front of the one
  // behind it, which is the only depth a plan drawn this small can have.
  const backToFront = [...placed].sort((a, b) => a.base - b.base)

  return {
    knockout,
    marks: backToFront.map((built) => ({
      body: built.body,
      width: 1,
      ink: 'line' as const,
    })),
    detail: '',
    pennant: null,
  }
}
