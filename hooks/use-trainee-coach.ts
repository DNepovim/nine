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

// How long an arriving line contends with the one already showing. The ladder
// exists for two messages about the same press — a habit, and the debrief for the
// hit that press landed. Past this window the line on screen has been read, and a
// fresh observation about the press just made should not lose to a stale one.
const CONTENTION_MS = 600

type Showing = { kind: CoachKind; text: string; at: number }

// Trainee's coach. Watches what the player does and says something about it in the
// line under the stat row — never which key to press, only what the last press or
// the last hit actually did.
export function useTraineeCoach({
  inRun,
  mode,
  grid,
  targets,
  batch,
  muted,
}: {
  inRun: boolean
  mode: Mode
  grid: Grid
  targets: readonly Target[]
  batch: HitBatch
  // True while a celebration owns the line. The coach drops what it would have said
  // rather than storing it: praise holds a second longer than a coach line does, so
  // a queued correction would surface after the shower ended, describing a press the
  // player made three seconds earlier. The debrief path already drops for the same
  // reason — this is that rule applied to the press path too.
  muted: boolean
}) {
  // Trainee only, and only while playing — the same gate the celebration keeps. The
  // other modes celebrate the run, and coaching mid-run there would talk over the
  // thing they are actually about.
  const active = inRun && mode === 'trainee'

  const [showing, setShowing] = useState<Showing | null>(null)
  const coachRef = useRef(initialCoachState())
  const lastSeqRef = useRef(batch.seq)
  const liveIdsRef = useRef<readonly number[]>([])

  // The dial delivers a swipe's callback about 110 ms after the gesture ends —
  // `animateSwipe` and `animateSet` both call `scheduleOnRN` from inside a
  // `withTiming` completion (`components/game/dial-button.tsx:78`, `:97`) — so a
  // handler that closed over its render's board can fire after a later press has
  // already moved it. These hold the last committed board instead, which is what
  // the machine will apply the delayed event against. This does not close the
  // window completely — two presses inside one React tick still leave the ref one
  // behind — but it is the board the pending press will actually land on.
  const gridRef = useRef(grid)
  const targetsRef = useRef(targets)
  useEffect(() => {
    gridRef.current = grid
    targetsRef.current = targets
  }, [grid, targets])

  // Lower-ranked lines are dropped rather than queued, unless the one on screen is
  // old enough to have been read: a correction held back three seconds would arrive
  // attached to the wrong press, but a habit line untouched for the whole window
  // must not silently swallow the debrief for a hit just landed.
  const say = (kind: CoachKind, text: string) => {
    if (muted) return
    const at = Date.now()
    setShowing((current) => {
      if (current === null) return { kind, text, at }
      if (at - current.at < CONTENTION_MS && !outranks(kind, current.kind)) {
        return current
      }
      return { kind, text, at }
    })
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
  // while the snapshot still holds the grid from before the press. These read the
  // refs above rather than closing over `grid`/`targets` directly, because a swipe's
  // callback fires well after the render that queued it.
  const notePress = (index: number, delta: 1 | -1) => {
    if (!active) return
    const gridBefore = gridRef.current
    judge(
      pressFacts({
        index,
        delta,
        gridBefore,
        gridAfter: buildPressGrid(gridBefore, index, delta),
        targets: targetsRef.current,
      }),
    )
  }

  const noteSet = (index: number, value: number) => {
    if (!active) return
    const gridBefore = gridRef.current
    judge(
      pressFacts({
        index,
        delta: null,
        gridBefore,
        gridAfter: buildSetGrid(gridBefore, index, value),
        targets: targetsRef.current,
      }),
    )
  }

  // What the hit cost. The figures are the machine's to report, so this comes off the
  // batch rather than from a press.
  useEffect(() => {
    // Tracked even while inactive: `seq` is monotonic across games and modes
    // (`freshGame` omits `hitBatch`), so a baseline that only advances while
    // Trainee is running would let another mode's last hit look fresh the moment
    // a Trainee run starts.
    if (batch.seq === lastSeqRef.current) return
    lastSeqRef.current = batch.seq
    if (!active) return
    // A clean hit gets confetti and praise, and a celebration is not the moment to
    // correct someone — the debrief is dropped rather than held. This and `muted`
    // (checked inside `say`) are the same rule reached by two routes, not one
    // guarding the other redundantly: this inspects the batch that just resolved,
    // while `muted` reflects what is actually on screen, and the celebration it
    // started outlasts that batch — so a later debrief can still land mid-shower
    // with `cleanHitReason` on its own *new* batch reading false.
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

  // Leaving Trainee, or leaving a run, starts the next one with a clean slate — now
  // that the debrief effect above tracks `lastSeqRef` even while inactive, a hit
  // landed in another mode cannot surface the moment Trainee starts.
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
