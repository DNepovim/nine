import { useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'

import { findPosition } from '@/lib/find-position'
import { type HitBatch, type HitInfo, type Target } from '@/machines/game'
import type { DisplayTarget, TargetExit } from '@/types/game'

// Which exit a departed target plays. Live targets never share a value — the spawner
// won't repeat one — so the hit carrying this value is this target's own. No hit at all
// means the clock took it, and a hit that cost a life took it just as surely: to the
// player, running out and dialling it wastefully are the same loss.
const exitFor = (value: number, hits: readonly HitInfo[]): TargetExit => {
  const hit = hits.find((h) => h.value === value)
  return hit !== undefined && !hit.costLife ? 'hit' : 'failed'
}

// Mirrors the machine's targets into a display list that outlives removals long
// enough to play exit animations, assigns each new target a non-overlapping
// position, and clears the list when a fresh game starts.
export function useDisplayedTargets({
  machineTargets,
  hitBatch,
  runSeq,
}: {
  machineTargets: Target[]
  // The press that just landed, if any. It is what tells a target the player dialled
  // from one the clock took, and a wasteful Accuracy hit from a clean one.
  hitBatch: HitBatch
  // Which run these targets belong to. Every fresh deal bumps it — including RESTART
  // from a pause, which never passes through the menu or game over and so cannot be
  // spotted from the state name alone. RESUME leaves it where it is, which is what
  // keeps a resumed board intact.
  runSeq: number
}) {
  const [displayedTargets, setDisplayedTargets] = useState<DisplayTarget[]>([])
  const containerSize = useRef({ width: 0, height: 0 })
  const lastHitSeq = useRef(hitBatch.seq)

  useEffect(() => {
    const live = new Map(machineTargets.map((t) => [t.id, t]))
    // Only a batch we haven't seen yet explains this update. Without one, whatever
    // left the board left without a press — which is the clock running out.
    const hits = hitBatch.seq === lastHitSeq.current ? [] : hitBatch.hits
    lastHitSeq.current = hitBatch.seq
    setDisplayedTargets((prev) => {
      const updated = prev.map((t) => {
        if (t.exit !== null) return t
        const current = live.get(t.id)
        if (current === undefined) return { ...t, exit: exitFor(t.value, hits) }
        // The one field of a live target that can be rewritten under it: Trainee's
        // timeout slider moves everything on the board onto the new clock, and a
        // display copy made at spawn would still be drawing the old one.
        return current.duration === t.duration ? t : { ...t, duration: current.duration }
      })
      const displayedIds = new Set(prev.map((t) => t.id))
      const placed = [...updated]
      const incoming = machineTargets
        .filter((t) => !displayedIds.has(t.id))
        .map((t) => {
          const position = findPosition(
            placed,
            containerSize.current.width,
            containerSize.current.height,
          )
          const entry: DisplayTarget = { ...t, exit: null, position }
          placed.push(entry)
          return entry
        })
      return [...updated, ...incoming]
    })
  }, [machineTargets])

  // Clear displayed targets when a fresh run is dealt. Anything left over belongs to
  // the run just abandoned — including targets still playing their exit — and letting
  // it animate on over the new board is the least of it: the list keys on ids, so a
  // leftover is also what an arriving target has to get past to be drawn at all.
  const prevRunSeq = useRef(runSeq)
  useEffect(() => {
    if (runSeq !== prevRunSeq.current) setDisplayedTargets([])
    prevRunSeq.current = runSeq
  }, [runSeq])

  const removeDisplayed = (id: number) => {
    setDisplayedTargets((prev) => prev.filter((t) => t.id !== id))
  }

  const onContainerLayout = (event: LayoutChangeEvent) => {
    containerSize.current = {
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    }
  }

  return { displayedTargets, removeDisplayed, onContainerLayout }
}
