// The ground the arcade map is drawn on, as a function of where you are.
//
// Elevation is a hash of the world position at three octaves — so it is the same answer for
// the same place whoever asks, in whatever order, however many times. Nothing is kept
// between patches and nothing has to be: the land is not state, it is arithmetic.
//
// Coordinates are the map's own — pitches from where the run began, the same space
// `Crossroad.pos` is in (see machines/arcade.ts). That is what makes the field
// resolution-independent: a phone with a taller canvas has a longer pitch and gets the same
// country drawn bigger, rather than a different country.

// The three octaves, in pitches. The widest is what makes a region feel like one place; the
// narrowest is what stops a hillside being a plane.
const OCTAVES = [
  { cell: 1.27, weight: 0.56, salt: 0 },
  { cell: 0.55, weight: 0.3, salt: 101 },
  { cell: 0.24, weight: 0.14, salt: 202 },
] as const

// One lattice corner's value. FNV-ish mixing of the two coordinates and the run's seed —
// cheap, and well enough distributed that two octaves of it do not line up into stripes.
export function hashAt(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) >>> 0
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smooth = (t: number): number => t * t * (3 - 2 * t)

// Value noise: the four corners of the cell a point falls in, smoothed between.
export function noiseAt(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell)
  const gy = Math.floor(y / cell)
  const fx = smooth(x / cell - gx)
  const fy = smooth(y / cell - gy)
  const a = hashAt(gx, gy, seed)
  const b = hashAt(gx + 1, gy, seed)
  const c = hashAt(gx, gy + 1, seed)
  const d = hashAt(gx + 1, gy + 1, seed)
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
}

// How high the ground is at a point, in the 0–1 the three octaves add up to. Around 0.5 on
// average, and it is the *relative* number that matters: a region's sea level and a river's
// descent are both read against it rather than against a unit.
export function elevationAt(x: number, y: number, seed: number): number {
  let e = 0
  for (const octave of OCTAVES) {
    e += octave.weight * noiseAt(x, y, octave.cell, seed + octave.salt)
  }
  return e
}

// Which way is downhill, by central differences. What a river follows.
export function slopeAt(x: number, y: number, seed: number): { x: number; y: number } {
  const d = 0.03
  return {
    x: (elevationAt(x + d, y, seed) - elevationAt(x - d, y, seed)) / (2 * d),
    y: (elevationAt(x, y + d, seed) - elevationAt(x, y - d, seed)) / (2 * d),
  }
}
