import { useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'

import { drillPlaces } from '@/lib/drill'
import { clampToContainer, findPosition, fitsContainer } from '@/lib/find-position'
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

// Where a drilled run's cards stand on a canvas of this size, and how big they are, or
// null for a run that places its own. Memoising it would be the wrong trade: it is a few
// hundred arithmetic steps, it is asked only when a card arrives or the board is
// measured, and a cache keyed on three values is more code than the thing it saves.
const drilled = (
  drill: { seed: string; count: number } | null,
  width: number,
  height: number,
) =>
  drill === null || width <= 0 || height <= 0
    ? null
    : drillPlaces(drill.seed, drill.count, width, height)

// Mirrors the machine's targets into a display list that outlives removals long
// enough to play exit animations, assigns each new target a non-overlapping
// position, and clears the list when a fresh game starts or the stepper puts a tutorial
// run back on an earlier board.
export function useDisplayedTargets({
  machineTargets,
  hitBatch,
  runSeq,
  rewindSeq,
  restoredPositions,
  drill,
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
  // How many times the stepper has put this run back on an earlier board. A rewind
  // replaces the board without dealing a run, so it moves neither of the two counters
  // above — see the clear below for why this one has to be here.
  rewindSeq: number
  // Where each target of a run put back from storage was sitting when the app was
  // closed, by id — see lib/saved-run.ts. Empty on every other launch, and it stays
  // usable for the whole run: `nextTargetId` is restored along with the board, so no
  // target spawned afterwards can be dealt an id that is in here.
  restoredPositions: ReadonlyMap<number, Position>
  // The **drill** this run deals from, or null for a run that rolls its targets.
  //
  // A drilled run does not place its cards, it is *given* their places: the same nine
  // spots every run of that session, scattered from the session's own id. So the two
  // things this hook normally decides — where a card goes, and how big it is — are
  // answers it looks up instead.
  //
  // Recomputed whenever the canvas changes rather than once at placement, which is the
  // whole reason it is held here. The first target of a run can arrive before the board
  // has been measured, and a place worked out against a canvas of nought would be the
  // one place that card kept for the rest of the run.
  drill: { seed: string; count: number } | null
}) {
  const [displayedTargets, setDisplayedTargets] = useState<DisplayTarget[]>([])
  const containerSize = useRef({ width: 0, height: 0 })
  // Read at placement time, like the canvas beside it: a drill arriving a render after
  // the first card would otherwise place that card by rolling.
  const drillRef = useRef(drill)
  drillRef.current = drill
  // The same measurement again, as state. The ref above is read at placement time and must
  // not cause a render; this is for the tutorial, which puts a card beside a target — above
  // it or below it depending on the room — and so has to re-render when the canvas changes.
  const [canvas, setCanvas] = useState({ width: 0, height: 0 })
  const lastHitSeq = useRef(hitBatch.seq)
  const prevRunSeq = useRef(runSeq)
  const prevRewindSeq = useRef(rewindSeq)

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
    //
    // A rewind is the same case for a different reason. It replaces the board without
    // dealing a run, so nothing here would mark it: the target it takes off is still
    // standing, falls out of `live`, and is exited with no hit to explain it — which is
    // the *failure* exit, the squash and fade that means the clock took it. In the one
    // run where nothing can be lost, every use of the stepper would show the player a
    // loss. Cleared instead, the board the player stepped back to simply arrives.
    const clearsBoard =
      runSeq !== prevRunSeq.current || rewindSeq !== prevRewindSeq.current
    prevRunSeq.current = runSeq
    prevRewindSeq.current = rewindSeq

    const live = new Map(machineTargets.map((t) => [t.id, t]))
    // Only a batch we haven't seen yet explains this update. Without one, whatever
    // left the board left without a press — which is the clock running out.
    const hits = hitBatch.seq === lastHitSeq.current ? [] : hitBatch.hits
    lastHitSeq.current = hitBatch.seq
    setDisplayedTargets((prev) => {
      const standing = clearsBoard ? [] : prev
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
          // A drilled card's place is the drill's, by the target's `seq` — its place
          // in *this run*. Not its id, which climbs for the life of the machine and so
          // points past the end of the drill on every run after the first.
          //
          // Ahead of the restored place on purpose: the two agree whenever the canvas
          // does, and where they disagree the drill is the one telling the truth about
          // where this session's fifth target stands.
          const spot = drilled(
            drillRef.current,
            containerSize.current.width,
            containerSize.current.height,
          )?.[t.seq]?.at
          const kept = restoredPositions.get(t.id)
          const position =
            spot ??
            (kept !== undefined &&
            fitsContainer(kept, containerSize.current.width, containerSize.current.height)
              ? kept
              : findPosition(
                  placed,
                  containerSize.current.width,
                  containerSize.current.height,
                ))
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
  }, [machineTargets, runSeq, rewindSeq])

  const removeDisplayed = (id: number) => {
    setDisplayedTargets((prev) => prev.filter((t) => t.id !== id))
  }

  const onContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    containerSize.current = { width, height }
    setCanvas({ width, height })
    // A canvas that shrank under cards already standing on it brings them back inside.
    // The measurement a target was placed against is not always the canvas it lives in —
    // see clampToContainer for the three ways the two come apart — and a card left where
    // it was would hang over the sum row below.
    setDisplayedTargets((prev) => {
      // A drilled board is re-placed rather than pulled back in. Its places are a pure
      // function of the session and the canvas, so a canvas that changed has new ones —
      // and clamping the old places would slide two cards towards the same edge and let
      // them touch, which a scatter is built never to do.
      const laid = drilled(drillRef.current, width, height)
      const pulled = prev.map((target) => {
        const position =
          laid?.[target.seq]?.at ?? clampToContainer(target.position, width, height)
        return position.x === target.position.x && position.y === target.position.y
          ? target
          : { ...target, position }
      })
      // The same list back when nothing moved: a layout event that only confirms the
      // size the board already had is most of them, and none should re-render.
      return pulled.every((target, i) => target === prev[i]) ? prev : pulled
    })
  }

  // The drill's own cards — one per target, each with the size it is drawn at and the
  // place it stands in — or undefined for a run that places its own. Derived from
  // `canvas` rather than from the ref beside it, so it re-renders with the board it was
  // measured from.
  //
  // Handed back whole rather than as a size, because a drill's cards differ from one
  // another: the screen looks a card up by its target's id.
  const drillCards = drilled(drill, canvas.width, canvas.height)

  return {
    displayedTargets,
    removeDisplayed,
    onContainerLayout,
    canvas,
    drillCards,
  }
}
