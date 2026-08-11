import { useEffect, useRef, useState } from 'react'

import { debriefLine, outranks, pressLine, type CoachKind } from '@/lib/coach-lines'
import {
  coachReducer,
  initialCoachState,
  noteResolved,
  pressFacts,
  type PressFacts,
} from '@/machines/coach'
import {
  buildPressGrid,
  buildSetGrid,
  type Grid,
  type HitBatch,
  type Mode,
  type Target,
} from '@/machines/game'
import { cleanHitReason } from '@/machines/scoring'

// How long a coach line holds. Shorter than the four seconds a praise line keeps:
// praise is tied to the length of its confetti shower, where a mid-route hint wants
// to be gone before the next press makes it stale.
const COACH_MS = 3000

type Showing = { kind: CoachKind; text: string }

// Trainee's coach. Watches what the player does and says something about it in the
// line under the stat row — never which key to press, only what the last press or
// the last hit actually did.
export function useTraineeCoach({
  inRun,
  mode,
  grid,
  targets,
  batch,
}: {
  inRun: boolean
  mode: Mode
  grid: Grid
  targets: readonly Target[]
  batch: HitBatch
}) {
  // Trainee only, and only while playing — the same gate the celebration keeps. The
  // other modes celebrate the run, and coaching mid-run there would talk over the
  // thing they are actually about.
  const active = inRun && mode === 'trainee'

  const [showing, setShowing] = useState<Showing | null>(null)
  const coachRef = useRef(initialCoachState())
  const lastSeqRef = useRef(batch.seq)
  const liveIdsRef = useRef<readonly number[]>([])

  // Lower-ranked lines are dropped rather than queued: a correction held back three
  // seconds would arrive attached to the wrong press.
  const say = (kind: CoachKind, text: string) => {
    setShowing((current) =>
      current === null || outranks(kind, current.kind) ? { kind, text } : current,
    )
  }

  const judge = (facts: PressFacts) => {
    const result = coachReducer(coachRef.current, facts)
    coachRef.current = result.state
    if (result.verdict === null) return
    // Rolled here rather than at render, so a re-render cannot reword the line while
    // the player is reading it.
    say(result.verdict, pressLine(result.verdict, Math.random()))
  }

  // Called at the dial beside the machine's PRESS and SET_CELL, and before them,
  // while the snapshot still holds the grid from before the press. These close over
  // this render's grid and targets rather than reading refs, because the dial builds
  // fresh handlers every render anyway.
  const notePress = (index: number, delta: 1 | -1) => {
    if (!active) return
    judge(
      pressFacts({
        index,
        delta,
        gridBefore: grid,
        gridAfter: buildPressGrid(grid, index, delta),
        targets,
      }),
    )
  }

  const noteSet = (index: number, value: number) => {
    if (!active) return
    judge(
      pressFacts({
        index,
        delta: null,
        gridBefore: grid,
        gridAfter: buildSetGrid(grid, index, value),
        targets,
      }),
    )
  }

  // What the hit cost. The figures are the machine's to report, so this comes off the
  // batch rather than from a press.
  useEffect(() => {
    if (!active) return
    if (batch.seq === lastSeqRef.current) return
    lastSeqRef.current = batch.seq
    // A clean hit gets confetti and praise, and a celebration is not the moment to
    // correct someone — the debrief is dropped rather than held.
    if (cleanHitReason(batch.hits) !== null) return
    // The last hit of the batch, the same one the stat row reports: a batch is every
    // target one press cleared, and it is that press the player is asking about.
    const last = batch.hits[batch.hits.length - 1]
    if (last === undefined) return
    say('debrief', debriefLine(last.steps, last.par))
  }, [active, batch])

  // Targets leaving the board — hit or expired — clear the route counters and advance
  // the habit cool-downs. Watching the id list catches both without the machine
  // having to report them separately, and comparing against the ids held from last
  // time makes a re-render with an unchanged board a no-op.
  useEffect(() => {
    const live = targets.map((target) => target.id)
    const resolved = liveIdsRef.current.filter((id) => !live.includes(id)).length
    liveIdsRef.current = live
    if (resolved > 0) coachRef.current = noteResolved(coachRef.current, resolved)
  }, [targets])

  // Leaving Trainee, or leaving a run, starts the next one with a clean slate.
  useEffect(() => {
    if (active) return
    coachRef.current = initialCoachState()
    liveIdsRef.current = []
    setShowing(null)
  }, [active])

  useEffect(() => {
    if (showing === null) return
    const timer = setTimeout(() => {
      setShowing(null)
    }, COACH_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [showing])

  return { line: showing?.text ?? null, notePress, noteSet }
}
