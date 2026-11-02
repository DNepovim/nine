import { useState } from 'react'

// The sum the sum row shows — the real one on every dial but a **freezing** one, where it
// is the sum the dial stood at when `key` last changed.
//
// The caller keys it on the run's id and its hit count, so the row takes the sum again at
// a run's start, on a restore, and when a hit lands — and on nothing else. A press that
// lands no hit moves the keys and leaves the row where it was.
//
// Taken in the render the key changes in, the way React keeps a value from a previous
// render, rather than in an effect after it: an effect would show the last hit's sum for
// a frame and then jump twice.
export function useHeldSum(
  sum: number,
  { freeze, key }: { freeze: boolean; key: string },
) {
  const [held, setHeld] = useState({ key, sum })
  if (held.key !== key) {
    setHeld({ key, sum })
    return sum
  }
  return freeze ? held.sum : sum
}
