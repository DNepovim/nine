// The flakes of FREEZE's snow, as plain numbers: where each stands, how it falls and how it
// sways. Derived from a seed rather than rolled, so the flakes are the same on every render and
// the opening's and the remains' meet without a flake jumping.

export type Flake = {
  // Where across the screen, nought to one.
  x: number
  // Where in its fall it starts, nought to one, and how long a fall takes, in ms.
  phase: number
  period: number
  // How wide it sways, how slowly (a larger figure is slower), and how big it is.
  drift: number
  sway: number
  size: number
  // How much of a shake's throw it takes, nought to one.
  lift: number
}

// A small, fast, seeded generator (mulberry32): nought up to one.
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// `count` flakes. The bigger a flake the nearer it is, so the quicker it falls: depth from
// nothing but size.
export function flurry(seed: number, count: number): Flake[] {
  const roll = seeded(seed)
  return Array.from({ length: count }, (_, index) => {
    const near = roll()
    return {
      // Evenly stood and then shaken, so they neither clump nor line up.
      x: (index + 0.1 + roll() * 0.8) / count,
      phase: roll(),
      period: 14_000 - near * 8_000,
      drift: 6 + roll() * 14,
      sway: 500 + roll() * 700,
      size: 2 + Math.round(near * 3),
      lift: 0.35 + roll() * 0.65,
    }
  })
}
