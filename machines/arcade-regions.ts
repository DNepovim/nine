// The regions an arcade run crosses, and which one a depth is in.
//
// Depth chooses the region, so a run crosses a world rather than wandering one. The change
// is meant to be felt rather than announced: you notice the trees closing in, and then you
// notice they have gone and the ground has started to rise.
//
// Every size in here is in **pitches** — the distance between two crossroads — rather than
// in points, so a taller canvas draws the same country bigger instead of a different one.
// The figure in each comment is what it comes to at the pitch of a 6.1" phone, about 132pt.

export type RegionKey = 'farmland' | 'forest' | 'hills' | 'mountains'

// What a lattice cell can hold. `none` is a cell left empty, which is as much a part of a
// region's character as what it puts in the others — farmland is mostly `none`.
export type FeatureKind = 'ridge' | 'hills' | 'wood'
type Slot = FeatureKind | 'none'

export type RegionConfig = {
  // The lattice the land is placed on, in pitches. Smaller is denser.
  cell: number
  // Weighted, and deliberately lopsided: a region that hedges reads as the same country
  // with the dial moved slightly.
  mix: readonly (readonly [Slot, number])[]
  ridge: {
    peaks: readonly [number, number]
    height: readonly [number, number]
    width: readonly [number, number]
  }
  hills: { bumps: readonly [number, number]; width: readonly [number, number] }
  wood: {
    trees: readonly [number, number]
    spread: number
    radius: readonly [number, number]
    // How likely this region's woods are firs rather than broadleaf. It is the one number
    // that makes a band read as somewhere colder without anything else changing.
    conifer: number
  }
}

const RIDGE_SMALL = {
  peaks: [2, 3],
  height: [0.1, 0.16], // 13–21pt
  width: [0.07, 0.1], // 9–13pt
} as const

const RIDGE_BIG = {
  peaks: [2, 3],
  height: [0.13, 0.21], // 17–28pt
  width: [0.08, 0.12], // 11–16pt
} as const

const HILLS_LOW = { bumps: [1, 3], width: [0.045, 0.072] } as const // 6–9.5pt

export const REGIONS = {
  // Nearly empty, and deliberately: small copses, a few low rises, and room. It is the
  // region the rest are measured against.
  farmland: {
    cell: 0.58, // 77pt — about 22 cells on a phone's canvas
    mix: [
      ['wood', 30],
      ['hills', 18],
      ['none', 52],
    ],
    ridge: RIDGE_SMALL,
    hills: HILLS_LOW,
    wood: { trees: [2, 4], spread: 0.22, radius: [0.026, 0.038], conifer: 0.1 },
  },
  // A canopy over the whole sheet for three crossroads. The only clearings are the ways
  // themselves and whatever stands on them.
  forest: {
    cell: 0.3, // 40pt — about 80 cells on a canvas, which is what makes a canopy
    mix: [
      ['wood', 94],
      ['hills', 6],
    ],
    ridge: RIDGE_SMALL,
    hills: HILLS_LOW,
    wood: { trees: [3, 6], spread: 0.19, radius: [0.029, 0.044], conifer: 0.5 },
  },
  // Rises everywhere, woods in the folds, and the first ranges showing at the back.
  hills: {
    cell: 0.41, // 54pt
    mix: [
      ['hills', 54],
      ['wood', 26],
      ['ridge', 10],
      ['none', 10],
    ],
    ridge: RIDGE_SMALL,
    hills: HILLS_LOW,
    wood: { trees: [3, 5], spread: 0.24, radius: [0.026, 0.04], conifer: 0.35 },
  },
  // Nothing but mountains, peak overlapping peak — which is only legible because every
  // peak knocks out the one behind it.
  mountains: {
    cell: 0.5, // 66pt — fewer cells, and almost every one of them a range
    mix: [
      ['ridge', 80],
      ['hills', 14],
      ['none', 6],
    ],
    ridge: RIDGE_BIG,
    hills: HILLS_LOW,
    wood: { trees: [2, 4], spread: 0.15, radius: [0.023, 0.031], conifer: 0.85 },
  },
} as const satisfies Record<RegionKey, RegionConfig>

// The order they are crossed in. The order *is* the journey — a run that went mountains,
// farmland, mountains would read as a shuffle rather than as a crossing.
//
// Four for now. The coast, the archipelago and the open sea are designed and wait on the
// hydrology: a region with a sea level and no water drawn in it would be a promise the
// screen does not keep.
export const REGION_ORDER = ['farmland', 'forest', 'hills', 'mountains'] as const

// How many crossroads a region lasts.
export const REGION_SPAN = 3

// Which region a depth is in. Cycles, so a run deeper than the list is long crosses the
// world again rather than running out of country.
export function regionAt(depth: number): RegionKey {
  const step = Math.floor(Math.max(0, depth) / REGION_SPAN) % REGION_ORDER.length
  return REGION_ORDER[step] ?? 'farmland'
}

// Where in the world a region begins and ends, in pitches up from the start. The land is a
// function of position rather than of the run, so the bands have to be readable off a y.
//
// Up is negative — the hero climbs — so the deeper band is the more negative one.
export function regionAtPosition(y: number): RegionKey {
  return regionAt(Math.floor(Math.max(0, -y)))
}
