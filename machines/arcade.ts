import { settlementName } from '@/lib/place-names'
import { parTable, speedFactor } from '@/machines/scoring'
import { decayed, FAST_HIT_THRESHOLD, NINE_DIAL, type Grid } from '@/modes'

// The dial an arcade run is played on. The same nine keys as everywhere else: the mode
// changes where a run goes, not what is pressed to get there. Named rather than reached
// for directly so the one place it would have to change is one place.
export const ARCADE_DIAL = NINE_DIAL

// Arcade's rules, with no pixels and no React in them: the map, what a crossroad offers,
// and how long the hero has to answer it.
//
// Not an XState machine and not a `Mode`. A run of this keeps no board, no lives and no
// streak, so it has nothing to say to machines/game.ts — and a fourth entry in `MODES`
// would have reached `Board`, the leaderboards, the saved run, the career and the
// achievements, none of which arcade is ready to be part of. The beats a run moves through
// are small enough to live in the hook that owns the clock; what needed testing is here.

// Straight up. Every angle in here is in radians, measured the way a screen measures them
// — y grows downward — so up is negative.
export const UP = -Math.PI / 2

// The crossroad a run starts on. Every other id spells the route taken to reach it: '1' is
// the second way out of the start, '1.0' the first way out of that.
export const START = ''

// How wide a fan is before the pull below straightens it, and how far each way is drawn
// back toward vertical. Together they decide how a four-way crossroad reads: the fan is
// wide enough for four buds to stand apart, and the pull is what keeps the outermost of
// them on the canvas rather than off the side of it.
const SPREAD = 1.18
const PULL = 0.5

// A little crookedness on each angle, so a three-way crossroad is never the same three
// angles twice. Small on purpose: any more and a fan stops reading as a fan.
const JITTER = 0.14

// How long a way is, in pitches. Uneven, so a crossroad looks grown rather than drawn.
const REACH_MIN = 0.86
const REACH_SPAN = 0.28

// Two to four ways, weighted toward three — the count that fills a fan without crowding
// it. Rolled per crossroad and never derived from depth: widening the fan as the run goes
// on would make deep play easier, which is backwards.
const WAY_COUNTS = [2, 3, 3, 4] as const

// How often a fan offers a walled village, and how many dry fans may pass before one is
// forced. A crossroad is the round: roughly one round in three has a siege in it, and a
// branch cannot go more than three without.
const FORT_CHANCE = 1 / 3
const FORT_DRY_MAX = 3

// What every way at a crossroad costs from the grid as it stands when the crossroad opens.
// A band rather than a number so a fan has candidates to choose from, and a narrow one so
// the choice between two ways is free — the mode is about where you go, not about which
// target is cheaper.
const PAR_MIN = 3
const PAR_MAX = 4

// How far the band may be stretched when it cannot fill an ask. A fan has never needed
// more than a step or two, but a deep siege asks for nine distinct numbers from a band
// two presses wide, and a grid that left it short would have no walls to knock down.
const PAR_STRETCH = 12

// The clock at the first crossroad, before depth tightens it.
//
// One pace, and no difficulty on top of it. Arcade already tightens as a run climbs, which
// is a difficulty that moves rather than one picked up front — and a three-way choice on
// the intro was asking the player to set a dial before they had any idea what the mode
// was. A run of this is the run of this.
//
// Where it sits: a crossroad asks for more than a target does — two to four numbers to
// read, a choice to make, then the three or four presses to land it — so this is about
// what Speed's Hard clock gives for one target, spent on a decision instead.
const BASE_CLOCK = 11000

export type ArcadeWay = {
  // The crossroad this way leads to, which is also its id.
  to: string
  angle: number
  // Length, in pitches. See `pos` below for why nothing in here is in points.
  reach: number
  // The target hung at this way's end.
  value: number
}

export type Crossroad = {
  id: string
  // What the settlement standing on it is called. Named when the crossroad is created, so a
  // place keeps its name for the whole run however often the player walks back to it.
  name: string
  // The crossroad this one was reached from, null at the start. Stored rather than read
  // back out of the id, which spells the same route: a retreat asks this every time, and
  // string surgery to answer it would be a second encoding of the same tree.
  from: string | null
  depth: number
  // Whether the village standing here is walled, and so has to be taken rather than
  // walked into. Decided when this crossroad is created — that is, when the fan that
  // offers it is grown — so a retreat gives back the same walls it left.
  fortified: boolean
  // How many fans in a row up this branch offered no walls. Carried rather than counted,
  // because the map is a tree: there is no sequence to look back along, only a parent.
  dry: number
  // Where the way in was pointing when it arrived, which is the axis the fan out of here
  // is measured from.
  heading: number
  // Where this crossroad sits, in pitches from the start. Unitless on purpose: a pitch is
  // a fraction of the canvas, which this module cannot see and which differs between
  // phones. lib/arcade-layout.ts is what turns these into points.
  pos: { x: number; y: number }
  // Empty until the crossroad is opened, and kept from then on — a crossroad reached a
  // second time offers the same ways with the same numbers.
  ways: readonly ArcadeWay[]
}

export type ArcadeMap = Readonly<Record<string, Crossroad>>

// A run's own source of randomness, so a map can be replayed — a seed is all a bug report
// needs — and so a test gets the same crossroad twice.
export type Rng = () => number

export function seeded(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// A crossroad id as a number — FNV-1a over its characters.
//
// Two things need one. The map needs a crossroad's randomness to depend on *which*
// crossroad it is rather than on how many were grown before it, so that growing one twice
// gives the same answer and React may call an updater as often as it likes. And the drawing
// needs each way to sway on its own phase, which has to be the same phase on every render
// or a fan would jitter instead of breathe.
export function idSeed(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash = ((hash ^ id.charCodeAt(i)) * 16777619) >>> 0
  }
  return hash
}

// The randomness one crossroad of one run is grown from. Pure in both its arguments, so a
// run is a seed and nothing else: the same seed walks the same map every time.
//
// Exported because a siege is grown the same way — see machines/siege.ts, which keys its
// own streams on `siege:${id}` so that nothing it rolls can shift the fan.
export const rngFor = (seed: number, id: string): Rng => seeded((seed ^ idSeed(id)) >>> 0)

// A one-crossroad map: where the hero stands when a run begins, with the fan out of it not
// yet grown. `openCrossroad` is what fills it, once the grid it should be measured against
// is known.
export function newMap(seed: number): ArcadeMap {
  return {
    [START]: {
      id: START,
      name: settlementName(rngFor(seed, `name:${START}`)),
      from: null,
      depth: 0,
      fortified: false,
      dry: 0,
      heading: UP,
      pos: { x: 0, y: 0 },
      ways: [],
    },
  }
}

const pick = <T>(items: readonly T[], rng: Rng): T | undefined =>
  items[Math.floor(rng() * items.length)]

// What a band of presses is, for the picker below. `exclude` is what is already live and
// may not be handed out twice — a siege asks for this, a fan never does.
export type ParBand = { min: number; max: number; exclude?: readonly number[] }

// Which sums are `count` distinct targets the given number of presses from here.
//
// The band first, widened only if it cannot fill the ask. Shuffled rather than taken in
// order, or every crossroad would offer the lowest few sums in the band and a run would
// climb through the same numbers every time.
//
// One picker for two callers that want the same thing at different prices: a fan wants
// three or four presses, a siege wants two or three and asks for far more of them.
export function parValues(
  grid: Grid,
  count: number,
  rng: Rng,
  band: ParBand,
): readonly number[] {
  const table = parTable(ARCADE_DIAL, grid)
  const barred = new Set(band.exclude ?? [])
  for (let stretch = 0; stretch <= PAR_STRETCH; stretch++) {
    const candidates: number[] = []
    for (let value = 1; value <= ARCADE_DIAL.maxSum; value++) {
      if (barred.has(value)) continue
      const par = table[value]
      if (par === undefined || !Number.isFinite(par)) continue
      if (par >= band.min && par <= band.max + stretch) candidates.push(value)
    }
    if (candidates.length < count) continue
    // Fisher–Yates, far enough to fill the ask and no further.
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(rng() * (candidates.length - i))
      const a = candidates[i]
      const b = candidates[j]
      if (a === undefined || b === undefined) continue
      candidates[i] = b
      candidates[j] = a
    }
    return candidates.slice(0, count)
  }
  return []
}

// What every way at a crossroad costs from the grid as it stands when the crossroad opens.
export function wayValues(grid: Grid, count: number, rng: Rng): readonly number[] {
  return parValues(grid, count, rng, { min: PAR_MIN, max: PAR_MAX })
}

// The fan out of one crossroad, and the crossroads at the far ends of it.
//
// Idempotent: a crossroad that already has ways is handed back untouched, which is what
// makes the map a place rather than a roll. A retreat lands on a crossroad this has already
// answered for, and it answers the same — including the way the hero just failed at, which
// is still a way.
//
// The destinations are created here rather than when one is walked, so the map is always
// whole: every way has a crossroad at its end, with an empty fan of its own until the hero
// gets there and this is called again.
export function openCrossroad(
  map: ArcadeMap,
  id: string,
  grid: Grid,
  // The run's seed rather than a prepared generator: a crossroad needs two streams of
  // randomness — one for its fan and one for the names of the places at the end of it — and
  // the only way to keep them from shifting each other is to derive both here.
  seed: number,
): ArcadeMap {
  const rng = rngFor(seed, id)
  const at = map[id]
  if (at === undefined) return map
  if (at.ways.length > 0) return map

  const count = pick(WAY_COUNTS, rng) ?? 3
  const values = wayValues(grid, count, rng)
  if (values.length === 0) return map

  // Rolled on a stream of its own rather than on the fan's, so adding walls to the map
  // moved no fan that existed before them: a seed that walked a way yesterday walks the
  // same way today.
  const fortRng = rngFor(seed, `fort:${id}`)
  const offers = !at.fortified && (at.dry >= FORT_DRY_MAX || fortRng() < FORT_CHANCE)
  const walled = offers ? Math.floor(fortRng() * values.length) : -1

  const ways: ArcadeWay[] = values.map((value, i) => {
    const fanned = at.heading + (i / Math.max(1, values.length - 1) - 0.5) * 2 * SPREAD
    const crooked = fanned + (rng() - 0.5) * JITTER
    return {
      to: id === START ? String(i) : `${id}.${i}`,
      // Drawn back toward vertical, so however the way in arrived the fan out still
      // climbs. Without it a run wanders sideways and walks off the canvas.
      angle: crooked + (UP - crooked) * PULL,
      reach: REACH_MIN + rng() * REACH_SPAN,
      value,
    }
  })

  const grown: Record<string, Crossroad> = { ...map, [id]: { ...at, ways } }
  ways.forEach((way, i) => {
    grown[way.to] = {
      id: way.to,
      from: id,
      depth: at.depth + 1,
      heading: way.angle,
      pos: {
        x: at.pos.x + Math.cos(way.angle) * way.reach,
        y: at.pos.y + Math.sin(way.angle) * way.reach,
      },
      ways: [],
      name: settlementName(rngFor(seed, `name:${way.to}`)),
      fortified: i === walled,
      dry: offers ? 0 : at.dry + 1,
    }
  })
  return grown
}

// The way that was taken to reach `id`, or null at the start — the way the clock cools
// along, and the way a retreat travels back down.
export function wayInto(map: ArcadeMap, id: string): ArcadeWay | null {
  const at = map[id]
  if (at?.from == null) return null
  return map[at.from]?.ways.find((way) => way.to === id) ?? null
}

export type TrailStep = { from: Crossroad; way: ArcadeWay }

// The last `depth` ways the hero walked, most recent first. What is drawn behind it: enough
// to say where the run came from, not so much that the canvas fills with history nobody can
// reach any more.
export function trail(map: ArcadeMap, id: string, depth: number): readonly TrailStep[] {
  const steps: TrailStep[] = []
  let at = map[id]
  while (at !== undefined && at.from !== null && steps.length < depth) {
    const here = at
    const from = map[here.from ?? '']
    const way = from?.ways.find((w) => w.to === here.id)
    if (from === undefined || way === undefined) break
    steps.push({ from, way })
    at = from
  }
  return steps
}

// Whether a crossroad was answered fast enough to be a **strike**.
//
// The same bar Speed's streak is measured against — more than `FAST_HIT_THRESHOLD` of the
// clock still full — because it is the same claim about the same kind of answer, and a mode
// at the far end of the spectrum should not move the goalposts a player already knows.
//
// What a strike buys is in the hook: the hero does not stop at the crossroad it lands on.
export function isStrike(leftMs: number, clockMs: number): boolean {
  return speedFactor(leftMs, clockMs) > FAST_HIT_THRESHOLD
}

// The way a rocket takes through a crossroad it never stops at: the one closest to the
// heading it arrived on.
//
// Momentum, in other words — and the only answer that needs no explaining on screen. A
// random pick would read as the game choosing for you; the straightest reads as carrying
// straight on, which is what the player just did.
export function straightestWay(at: Crossroad | undefined): ArcadeWay | null {
  if (at === undefined) return null
  let best: ArcadeWay | null = null
  let bend = Infinity
  for (const way of at.ways) {
    // Both angles are absolute, and either may have wrapped past π, so the difference is
    // measured the short way round the circle.
    const off = Math.abs(
      Math.atan2(Math.sin(way.angle - at.heading), Math.cos(way.angle - at.heading)),
    )
    if (off < bend) {
      bend = off
      best = way
    }
  }
  return best
}

// How long the hero has at a crossroad before it is pulled back down the way it came.
//
// Depth is the only thing that moves it, on the curve everything in the app that tightens
// already uses — so arcade gets the same decelerating squeeze Speed's clock does, counting
// crossroads where Speed counts hits. Deep enough and the clock is at 55% of where it
// started, which is the difficulty a run sets for itself.
export function crossroadClock(depth: number): number {
  return Math.round(decayed(BASE_CLOCK, depth))
}

// Walk the hero forward `steps` crossroads, growing each fan on the way.
//
// Only the dev tools call this — see the ARCADE section of components/overlays/dev-overlay.tsx.
// Reaching a six-tower siege means climbing a couple of dozen crossroads, and climbing them
// by hand to look at one thing is how a check stops being made.
//
// It walks rather than fakes: there is no depth to set on a run, because depth is where the
// hero *is*. So this grows the same fans an honest climb would, through the same
// `openCrossroad` every arrival goes through, and takes the first way out of each. What it
// leaves behind is a map a retreat can walk back down, which a teleport would not be.
//
// It stops early rather than loops forever if a fan comes up empty — `openCrossroad` hands
// back the map untouched when the grid cannot fill one, and a crossroad with no ways has
// nowhere to go.
export function deepen(
  map: ArcadeMap,
  at: string,
  grid: Grid,
  seed: number,
  steps: number,
): { map: ArcadeMap; at: string } {
  let walked = map
  let here = at
  for (let step = 0; step < steps; step++) {
    walked = openCrossroad(walked, here, grid, seed)
    const ways = walked[here]?.ways ?? []
    // The first way that does not end at a walled village, and only then the first way at
    // all. A climb that stopped on a fortified village would leave the hero somewhere a
    // real run never puts it — standing inside walls with no siege running, because the
    // game opens one on *arrival* and this is not an arrival. One way in a fan is walled at
    // most, so there is always another to take.
    const next = ways.find((way) => walked[way.to]?.fortified !== true) ?? ways[0]
    if (next === undefined) break
    here = next.to
  }
  // The crossroad it stops on is grown too, so the hero arrives somewhere with a fan rather
  // than somewhere that only becomes a place on the next render.
  walked = openCrossroad(walked, here, grid, seed)
  return { map: walked, at: here }
}
