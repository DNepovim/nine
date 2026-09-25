import { useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'

import { findPosition, fitsContainer } from '@/lib/find-position'
import { remainingFraction } from '@/lib/target-clock'
import { type HitBatch, type HitInfo, type Target } from '@/machines/game'
import type { DisplayTarget, Position, TargetExit } from '@/types/game'

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
  restoredPositions,
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
  // Where each target of a run put back from storage was sitting when the app was
  // closed, by id — see lib/saved-run.ts. Empty on every other launch, and it stays
  // usable for the whole run: `nextTargetId` is restored along with the board, so no
  // target spawned afterwards can be dealt an id that is in here.
  restoredPositions: ReadonlyMap<number, Position>
}) {
  const [displayedTargets, setDisplayedTargets] = useState<DisplayTarget[]>([])
  const containerSize = useRef({ width: 0, height: 0 })
  const lastHitSeq = useRef(hitBatch.seq)
  const prevRunSeq = useRef(runSeq)

  useEffect(() => {
    const now = Date.now()
    // A fresh deal — START, PLAY AGAIN, or a RESTART from a pause that never leaves
    // `playing` — takes the last run's board with it, including targets still playing
    // their exit. Letting those animate on over the new board is the least of it: the
    // list keys on ids, so a leftover is also what an arriving target would have to get
    // past to be drawn at all.
    //
    // Folded into the pass that mirrors the machine rather than kept in an effect of its
    // own, because the two used to race in the same commit and the one that lost was the
    // board put back from storage. That arrives under a run number of its own with
    // targets already on it, so the clear ran a moment after they were placed and wiped
    // every one — leaving a board that looked empty until the next press re-placed the
    // lot at once.
    const freshDeal = runSeq !== prevRunSeq.current
    prevRunSeq.current = runSeq

    const live = new Map(machineTargets.map((t) => [t.id, t]))
    // Only a batch we haven't seen yet explains this update. Without one, whatever
    // left the board left without a press — which is the clock running out.
    const hits = hitBatch.seq === lastHitSeq.current ? [] : hitBatch.hits
    lastHitSeq.current = hitBatch.seq
    setDisplayedTargets((prev) => {
      const standing = freshDeal ? [] : prev
      const updated = standing.map((t) => {
        if (t.exit !== null) return t
        const current = live.get(t.id)
        if (current === undefined) return { ...t, exit: exitFor(t.value, hits) }
        // The one field of a live target that can be rewritten under it: Trainee's
        // timeout slider moves everything on the board onto the new clock, and a
        // display copy made at spawn would still be drawing the old one.
        return current.duration === t.duration ? t : { ...t, duration: current.duration }
      })
      const displayedIds = new Set(standing.map((t) => t.id))
      const placed = [...updated]
      const incoming = machineTargets
        .filter((t) => !displayedIds.has(t.id))
        .map((t) => {
          // A target put back from storage goes back where it was, so the board the
          // player comes back to is the board they left. Anything else — and anything
          // remembered for a board this one no longer matches — is placed afresh.
          const kept = restoredPositions.get(t.id)
          const position =
            kept !== undefined &&
            fitsContainer(kept, containerSize.current.width, containerSize.current.height)
              ? kept
              : findPosition(
                  placed,
                  containerSize.current.width,
                  containerSize.current.height,
                )
          const entry: DisplayTarget = {
            ...t,
            exit: null,
            position,
            startProgress: remainingFraction(t, now),
          }
          placed.push(entry)
          return entry
        })
      return [...updated, ...incoming]
    })
  }, [machineTargets, runSeq])

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
