import { useEffect } from 'react'

import { msToNextStep } from '@/lib/target-drift'
import type { GameSend, Target } from '@/machines/game'

// Tells the machine each time a **drifting** number moves, so a target that drifts onto
// the sum already dialled is taken the moment it arrives — a press is not the only way a
// grid and a target can come to agree.
//
// Woken at the next step boundary of whichever drifting target reaches one first, then
// again from there; nothing runs on a run whose numbers hold still, and nothing while it is
// paused — RESUME moves every `spawnedAt` on, and the next wait is read from those. The
// machine ignores a tick that lands on nothing, so a tick never needs to know whether it
// will hit.
export function useDriftTicks({
  isPlaying,
  targets,
  step,
  send,
}: {
  isPlaying: boolean
  targets: readonly Target[]
  // The run's `spawn.drift`, or null where numbers hold still.
  step: number | null
  send: GameSend
}) {
  useEffect(() => {
    if (!isPlaying || step === null) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const arm = () => {
      const now = Date.now()
      const drifting = targets.filter((t) => t.drift !== 0)
      // Nothing drifting yet: look again in a step, which is the soonest one could matter.
      const wait = drifting.reduce(
        (soonest, t) => Math.min(soonest, msToNextStep(t, now, step)),
        step,
      )
      timer = setTimeout(() => {
        send({ type: 'TICK', now: Date.now() })
        arm()
      }, wait)
    }
    arm()
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
    // Re-armed whenever the board changes, so a target that has just arrived is counted
    // from its own first step rather than from whenever the last wait ends.
  }, [isPlaying, step, targets, send])
}
