// A lifetime total short enough to read at a glance: 940, 12.3k, 4.1M.
//
// A career score runs into the millions, and the profile shows it at display size on a
// line of its own — the full figure would either shrink to fit or wrap, and neither
// reads as a headline. Precision is not the point up there; the per-board table below is
// where exact numbers live.
//
// One decimal below ten of a unit and none above it, so a number never takes more than
// four characters plus its suffix: 9.9k, 84k, 1.2M.
const UNITS = [
  { at: 1e6, divisor: 1e6, suffix: 'M' },
  { at: 1000, divisor: 1000, suffix: 'k' },
] as const

export type CompactNumber = { value: string; suffix: string }

// Split rather than joined, because the two halves are set in different faces: the
// digits wear the seven-segment score face, which has no letters to draw a `k` with.
export function compactNumber(total: number): CompactNumber {
  const rounded = Math.round(total)
  const magnitude = Math.abs(rounded)
  // Picked on the rounded-up magnitude, so 999 999 reads as 1M rather than as 1000k.
  const unit = UNITS.find((candidate) => magnitude >= candidate.at - candidate.at / 2000)
  if (unit === undefined) return { value: String(rounded), suffix: '' }

  const scaled = rounded / unit.divisor
  const digits = Math.abs(scaled) < 9.95 ? 1 : 0
  return { value: scaled.toFixed(digits).replace(/\.0$/, ''), suffix: unit.suffix }
}
