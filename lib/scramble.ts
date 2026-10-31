import type { Rng } from '@/lib/rng'
import { sumOf, type DialSpec, type Grid } from '@/modes'

// How many fresh draws a **scramble** gets before it stops drawing and starts stepping.
// A draw lands on a standing target's number about once in every few dozen on the nine
// dial, so the fallback below is there to make termination a fact rather than a bet, not
// because it is ever expected to run.
const DRAWS = 32

// The digits one key may land on: neither the one the hit left it on nor the one it showed
// before the press that made the hit. The two differ only on the key that press moved, and
// that is the key that matters — a scramble that put it back where it started would read
// as the swipe being undone rather than the dial moving.
//
// On a dial of two digits the key that moved has nowhere left to go, so it keeps only the
// first rule: it is still never left on the digit the hit put it on.
function landingsFor(dial: DialSpec, dialled: number, before: number): readonly number[] {
  const all = Array.from({ length: dial.digits }, (_, digit) => digit)
  const fresh = all.filter((digit) => digit !== dialled && digit !== before)
  return fresh.length > 0 ? fresh : all.filter((digit) => digit !== dialled)
}

// One draw: every key moved to one of its landings, uniformly among them.
const draw = (landings: readonly (readonly number[])[], rng: Rng): Grid =>
  landings.map((options) => options[Math.floor(rng() * options.length)] ?? 0)

// The dial after a hit has **scrambled** it: every key on a digit it was not showing —
// neither after the press nor before it — and a sum that is none of `avoid`, the numbers
// of the targets still standing, as they show now, so the scramble can never take a target
// the player did not dial.
//
// Pure in its rng, which the machine seeds on the run and the hit (it reads no randomness
// of its own): the same run scrambles the same way on every replay of the same hit, so a
// restored run and a test both see the grid the player saw.
//
// Drawn whole until the sum is clear, and only then, if the draws ran out, stepped one key
// at a time through the digits that still keep every key off its old ones. A dial too small
// to meet both rules at once — two digits, so every key's new digit is forced, or a single
// key with every other sum standing — keeps the first rule and gives up the second:
// every key still moves, which is the thing the player can see.
//
// A dial whose keys take one digit has nowhere to move them, and is handed back as it was.
export function scrambleGrid(
  dial: DialSpec,
  grid: Grid,
  avoid: readonly number[],
  rng: Rng,
  // The dial before the press that made the hit. The grid itself by default, for a caller
  // with no press behind it.
  before: Grid = grid,
): Grid {
  if (dial.digits < 2) return grid
  const clear = (candidate: Grid) => !avoid.includes(sumOf(dial, candidate))
  const landings = grid.map((dialled, i) =>
    landingsFor(dial, dialled, before[i] ?? dialled),
  )

  let last = draw(landings, rng)
  for (let attempt = 1; attempt < DRAWS && !clear(last); attempt++) {
    last = draw(landings, rng)
  }
  if (clear(last)) return last

  for (let index = 0; index < last.length; index++) {
    for (const digit of landings[index] ?? []) {
      const stepped = last.map((value, i) => (i === index ? digit : value))
      if (clear(stepped)) return stepped
    }
  }
  return last
}
