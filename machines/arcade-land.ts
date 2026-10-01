import { hashAt } from '@/lib/atlas-field'
import {
  REGION_SPAN,
  regionAtPosition,
  REGIONS,
  type FeatureKind,
  type RegionConfig,
  type RegionKey,
} from '@/machines/arcade-regions'

// The land, as a function of where you are.
//
// One feature to a lattice cell, and a cell's answer depends on nothing but its own
// coordinates and the run's seed. That is what makes the country infinite, seamless and
// free: there are no patches to stitch, no tiles to keep and nothing to prune. Two cells
// never have to agree about anything, because neither can see the other.
//
// Everything in here is in pitches, like machines/arcade.ts and lib/atlas-field.ts.

// What a feature can be.
type PeakForm = 'round' | 'crag' | 'flat'
type BumpForm = 'bump' | 'hummock'
type TreeForm = 'lobed' | 'round' | 'fir' | 'spruce' | 'bare'

export type Peak = {
  x: number
  y: number
  height: number
  width: number
  form: PeakForm
  // Which flank is in shade, so two ranges on one screen are lit from different sides.
  flip: boolean
  seed: number
}
export type Bump = { x: number; y: number; width: number; form: BumpForm; seed: number }
export type Tree = { x: number; y: number; radius: number; form: TreeForm; seed: number }

export type LandFeature = {
  kind: FeatureKind
  // The cell it came from, which is its React key and its cache key.
  key: string
  // The lowest point in it. The land is drawn in this order, so whatever is nearer the
  // bottom of the screen is drawn last and knocks out what stands behind it.
  at: number
  peaks: readonly Peak[]
  bumps: readonly Bump[]
  trees: readonly Tree[]
}

// How far inside its cell a feature's elements stay. Not the whole safezone: terrain *may*
// overlap terrain, and with every mark knocking out the one behind it, two ranges meeting
// across a cell boundary read as one massif rather than as a collision. This is only the
// gap that stops them landing exactly on top of each other.
const PAD = {
  ridge: 0.045,
  hills: 0.04,
  // Tight on purpose: a wood is trees close together, and the forest region is supposed to
  // close over.
  wood: 0.015,
} as const satisfies Record<FeatureKind, number>

// A cell's own randomness. Hashed from its coordinates rather than counted along a
// sequence, so a cell gives the same answer whenever it is asked and in whatever order the
// screen happens to ask.
function cellRng(gx: number, gy: number, seed: number): () => number {
  let state = (hashAt(gx, gy, seed) * 4294967296) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const between = (rng: () => number, range: readonly [number, number]): number =>
  range[0] + rng() * (range[1] - range[0])

const count = (rng: () => number, range: readonly [number, number]): number =>
  range[0] + Math.floor(rng() * (range[1] - range[0] + 1))

const choose = <T>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)] as T

// A cell's identity. The region is part of it because the lattice differs per region: the
// same two coordinates mean a different place in the forest than in the mountains.
export const cellKey = (region: RegionKey, gx: number, gy: number): string =>
  `${region}:${gx}:${gy}`

// Whether something may stand at a point: the caller's keep-out test, which is how the ways
// and the settlements get their safezones. Terrain is the only thing that yields — a way
// the player cannot read their own route on is not atmosphere, it is a bug.
export type Blocked = (x: number, y: number, radius: number) => boolean

// One per slot, so each reads as the shape it makes rather than as a branch of one
// function that makes three.

function ridgeIn(
  region: RegionConfig,
  rng: () => number,
  at: { x: number; y: number },
  key: string,
  blocked: Blocked,
): LandFeature | null {
  // One kind of mountain to a range, and one lit flank: a range of mixed peaks reads as
  // noise, and two ranges of different peaks read as two different places.
  const form = choose(rng, ['round', 'crag', 'flat'] as const)
  const flip = rng() < 0.4
  const wanted = count(rng, region.ridge.peaks)
  const peaks: Peak[] = []
  let x = at.x - (wanted - 1) * 0.05
  for (let i = 0; i < wanted; i++) {
    const width = between(rng, region.ridge.width)
    const y = at.y + (rng() - 0.5) * 0.03
    // Peaks of one range are meant to overlap, so only the caller's keep-out applies.
    if (!blocked(x, y, width)) {
      peaks.push({
        x,
        y,
        height: between(rng, region.ridge.height),
        width,
        form,
        flip,
        seed: Math.floor(rng() * 1e9),
      })
    }
    x += width * (1.05 + rng() * 0.35)
  }
  if (peaks.length === 0) return null
  const ordered = [...peaks].sort((a, b) => a.y - b.y)
  return {
    kind: 'ridge',
    key,
    at: Math.max(...ordered.map((p) => p.y)),
    peaks: ordered,
    bumps: [],
    trees: [],
  }
}

function hillsIn(
  region: RegionConfig,
  rng: () => number,
  at: { x: number; y: number },
  key: string,
  blocked: Blocked,
): LandFeature | null {
  const form = choose(rng, ['bump', 'hummock'] as const)
  const wanted = count(rng, region.hills.bumps)
  const bumps: Bump[] = []
  let x = at.x
  for (let i = 0; i < wanted; i++) {
    const width = between(rng, region.hills.width)
    if (!blocked(x, at.y, width)) {
      bumps.push({ x, y: at.y, width, form, seed: Math.floor(rng() * 1e9) })
    }
    x += width * (1.7 + rng() * 0.6)
  }
  if (bumps.length === 0) return null
  return { kind: 'hills', key, at: at.y, peaks: [], bumps, trees: [] }
}

function woodIn(
  region: RegionConfig,
  rng: () => number,
  centre: { x: number; y: number },
  key: string,
  blocked: Blocked,
): LandFeature | null {
  // One kind of tree to a wood, drawn from the region's own leaning.
  const form =
    rng() < region.wood.conifer
      ? choose(rng, ['fir', 'spruce'] as const)
      : choose(rng, ['lobed', 'round', 'lobed', 'bare'] as const)
  const wanted = count(rng, region.wood.trees)
  const trees: Tree[] = []
  for (let i = 0; i < wanted; i++) {
    // Woods are allowed to spill into the next cell: that is how the forest region closes
    // over, and two canopies that touch read as one wood rather than as a mistake.
    const x = centre.x + (rng() - 0.5) * region.wood.spread
    const y = centre.y + (rng() - 0.5) * region.wood.spread * 0.7
    const radius = between(rng, region.wood.radius)
    if (blocked(x, y, radius)) continue
    trees.push({ x, y, radius, form, seed: Math.floor(rng() * 1e9) })
  }
  if (trees.length === 0) return null
  const ordered = [...trees].sort((a, b) => a.y - b.y)
  return {
    kind: 'wood',
    key,
    at: Math.max(...ordered.map((t) => t.y)),
    peaks: [],
    bumps: [],
    trees: ordered,
  }
}

// What stands in one cell, or nothing.
export function featureIn(
  regionKey: RegionKey,
  gx: number,
  gy: number,
  seed: number,
  blocked: Blocked,
): LandFeature | null {
  const region = REGIONS[regionKey]
  const cell = region.cell
  const rng = cellRng(gx, gy, seed)
  const key = cellKey(regionKey, gx, gy)

  const total = region.mix.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rng() * total
  let slot: FeatureKind | 'none' = 'none'
  for (const [name, weight] of region.mix) {
    roll -= weight
    if (roll <= 0) {
      slot = name
      break
    }
  }
  if (slot === 'none') return null

  // How far from the cell's centre an element may sit: half the cell, less the gap that
  // keeps neighbouring cells from landing exactly on top of each other.
  const room = Math.max(0.01, cell / 2 - PAD[slot])
  const at = {
    x: (gx + 0.5) * cell + (rng() - 0.5) * 2 * room,
    y: (gy + 0.5) * cell + (rng() - 0.5) * 2 * room,
  }

  if (slot === 'ridge') return ridgeIn(region, rng, at, key, blocked)
  if (slot === 'hills') return hillsIn(region, rng, at, key, blocked)
  return woodIn(region, rng, at, key, blocked)
}

export type LandWindow = { left: number; right: number; top: number; bottom: number }

// Every cell whose centre falls in a window of the world, in the order they should be drawn
// — back to front, so the nearer mark knocks out the one behind it.
//
// Walked per region band rather than on one grid, because the lattice differs per region and
// a window can straddle two of them. A band is `REGION_SPAN` pitches tall, and `y` grows
// downward, so the band above is the more negative one.
export function featuresIn(
  window: LandWindow,
  cached: (region: RegionKey, gx: number, gy: number) => LandFeature | null,
): readonly LandFeature[] {
  const found: LandFeature[] = []

  // Which regions the window reaches, deepest first. Sampled at the middle of each band
  // rather than walked cell by cell, because the lattice is not known until the region is.
  const regions: RegionKey[] = []
  const first = Math.floor(window.top / REGION_SPAN)
  const last = Math.floor(window.bottom / REGION_SPAN)
  for (let band = first; band <= last; band++) {
    const regionKey = regionAtPosition(band * REGION_SPAN + REGION_SPAN / 2)
    if (!regions.includes(regionKey)) regions.push(regionKey)
  }

  // Then each region's own lattice, over the whole window — and a row is taken only by the
  // region its centre is in. That is what keeps a cell from being generated twice: two
  // bands can resolve to the same region, but a row has one centre and one answer.
  for (const regionKey of regions) {
    const cell = REGIONS[regionKey].cell
    for (
      let gy = Math.floor(window.top / cell);
      gy <= Math.floor(window.bottom / cell);
      gy++
    ) {
      if (regionAtPosition((gy + 0.5) * cell) !== regionKey) continue
      for (
        let gx = Math.floor(window.left / cell);
        gx <= Math.floor(window.right / cell);
        gx++
      ) {
        const feature = cached(regionKey, gx, gy)
        if (feature !== null) found.push(feature)
      }
    }
  }

  return found.sort((a, b) => a.at - b.at)
}
