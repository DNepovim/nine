import { lerpColor } from '@/machines/modes'

// Samples a multi-stop hex gradient at t ∈ [0,1]. Out-of-range t clamps to the
// end stops, so callers don't have to guard their own arithmetic.
export function sampleSpectrum(stops: readonly string[], t: number): string {
  const first = stops[0]
  if (first === undefined) return '#000000'
  const last = stops[stops.length - 1] ?? first
  if (t <= 0) return first
  if (t >= 1) return last

  const scaled = t * (stops.length - 1)
  const index = Math.floor(scaled)
  const from = stops[index] ?? first
  const to = stops[index + 1] ?? last
  return lerpColor(from, to, scaled - index)
}

// Evenly spaced samples across the whole gradient — `count` of them, first and
// last landing exactly on the end stops.
export function spreadSpectrum(stops: readonly string[], count: number): string[] {
  if (count <= 1) return [sampleSpectrum(stops, 0)]
  return Array.from({ length: count }, (_, i) => sampleSpectrum(stops, i / (count - 1)))
}
