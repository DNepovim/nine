import { useEffect, useRef, useState } from 'react'

import { driftedValue, msToNextStep, type Drift } from '@/lib/target-drift'

// The number a **drifting** target's card shows, kept to the machine's own reading of it:
// `driftedValue` at the moment, re-read the instant each step comes due. The same function
// of `now − spawnedAt` the machine matches a press against, so the card and the hit can
// never be a frame apart — counting steps off the ring was, by the ring's late start and a
// render per step.
//
// Woken at each step boundary rather than on an interval, so nothing runs between steps
// and a card that never drifts runs nothing at all. Stops while `running` is false —
// paused, or on its way out — which holds the number where it stood: on a hit, the number
// it was taken at. A resume moves `spawnedAt` on by the time away, and the next reading
// picks it up from there.
export function useDriftedValue(
  target: { value: number; drift: Drift; spawnedAt: number },
  step: number | null,
  running: boolean,
): number {
  const { value, drift, spawnedAt } = target
  const read = () => driftedValue({ value, drift, spawnedAt }, Date.now(), step)
  const [shown, setShown] = useState(read)
  // The clock this card last read its number off. A resume moves the run's `spawnedAt` on
  // by the time away, but this card's copy of it catches up a render after the card
  // starts running again — read in between, the whole pause would show as steps, a jump
  // that can land off the dial. So starting to run reads nothing; the reading comes when
  // the clock itself is seen to move.
  const clock = useRef({ value, drift, spawnedAt, step })

  useEffect(() => {
    // Stopped — paused, or leaving on a hit or a lost ring — keeps the number last shown.
    if (!running) return
    const last = clock.current
    const moved =
      last.value !== value ||
      last.drift !== drift ||
      last.spawnedAt !== spawnedAt ||
      last.step !== step
    clock.current = { value, drift, spawnedAt, step }
    if (moved) setShown(read())
    if (step === null || drift === 0) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const arm = () => {
      timer = setTimeout(
        () => {
          setShown(read())
          arm()
        },
        msToNextStep({ spawnedAt }, Date.now(), step),
      )
    }
    arm()
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
    // `read` closes over exactly these, and is rebuilt with them.
  }, [value, drift, spawnedAt, step, running])

  return shown
}
