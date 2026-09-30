import type { MessageDescriptor } from '@lingui/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { type Grid, type HitBatch, type Target } from '@/machines/game'
import { computeKeyPlan } from '@/machines/scoring'
import {
  dismissedByTap,
  FIRST_STEP,
  LESSON_AFTER_HIT,
  LESSON_DIAL,
  LESSON_HOLD_MS,
  LESSON_LINE,
  LESSON_VOICE,
  lessonStep,
  type LessonDial,
  type LessonStep,
  type LessonVoice,
  type Swipe,
} from '@/machines/tutorial-lesson'

// The tutorial's lesson, driven. The order of it is machines/tutorial-lesson.ts; what is
// here is the three things only React can do — run the holds, notice the hit, and notice
// the dial going past the target.
export function useTutorialLesson({
  tutorial,
  isPlaying,
  runSeq,
  rewindSeq,
  hits,
  batch,
  grid,
  targets,
}: {
  tutorial: boolean
  // Paused counts as not playing, which stops the two banner holds where they are: a banner
  // that timed out behind the pause screen would be read by nobody. Coming back restarts
  // the hold it was in rather than resuming it, which is the generous way round. The
  // pointing cards are on no clock at all and so cannot be lost to a pause.
  isPlaying: boolean
  // Which run this is. Every fresh deal restarts the lesson, and every run that is not a
  // tutorial has none.
  runSeq: number
  // How many rewinds the stepper has sent this session. A counter for the reason `runSeq`
  // is one: going back to the board already under the player is a real request, and a
  // flag would have nothing to change.
  rewindSeq: number
  hits: number
  batch: HitBatch
  grid: Grid
  targets: readonly Target[]
}) {
  // A lesson belongs to a fresh tutorial run. A tutorial put back from storage mid-run has
  // already had it, and `hits` is how that shows.
  //
  // Read when a run arrives rather than depended on: the hit count moves inside a run, and
  // an effect watching it would restart the lesson on the first hit of the very run it was
  // teaching. The run number is the only thing that may restart one.
  const openingRef = useRef({ tutorial, hits })
  openingRef.current = { tutorial, hits }
  const [step, setStep] = useState<LessonStep>(() =>
    tutorial && hits === 0 ? FIRST_STEP : 'done',
  )

  const dealt = useRef(runSeq)
  useEffect(() => {
    if (dealt.current === runSeq) return
    dealt.current = runSeq
    const { tutorial: isTutorial, hits: landed } = openingRef.current
    setStep(isTutorial && landed === 0 ? FIRST_STEP : 'done')
  }, [runSeq])

  // A rewind, followed. The board under the player has moved to a scripted one, so the
  // lesson goes to the step that board opens on — the same table a hit reads, indexed by
  // the same hit count.
  //
  // Set rather than sent through `lessonStep`, which short-circuits at `done`: a player
  // going back after the script has run out would otherwise be put on a scripted board
  // with the lesson still saying nothing.
  const rewound = useRef(rewindSeq)
  useEffect(() => {
    if (rewound.current === rewindSeq) return
    rewound.current = rewindSeq
    setStep(LESSON_AFTER_HIT[openingRef.current.hits] ?? 'done')
  }, [rewindSeq])

  const active = tutorial && isPlaying

  const advance = useCallback(() => {
    setStep((current) => lessonStep(current, { type: 'ADVANCE' }))
  }, [])

  // Every swipe the dial reports, so the three gesture lessons can each see the one they
  // asked for. Handed all of them rather than filtered at the call site: the step is what
  // knows which gesture it is waiting on, and every other step ignores the lot.
  const noteSwipe = useCallback((swipe: Swipe) => {
    setStep((current) => lessonStep(current, { type: 'SWIPED', swipe }))
  }, [])

  // A press on a key, as the dial reports one. Down is a swipe down; up is a tap, which the
  // lesson never has to ask for and so never listens for.
  const notePress = useCallback(
    (delta: 1 | -1) => {
      if (delta === -1) noteSwipe('down')
    },
    [noteSwipe],
  )

  // A key set outright, which is the two side swipes: left empties it, right fills it. Any
  // other value is not a gesture the dial can produce.
  const noteSet = useCallback(
    (value: number) => {
      if (value === 0) noteSwipe('left')
      if (value === 9) noteSwipe('right')
    },
    [noteSwipe],
  )

  // The hold. A step with no hold arms nothing and waits for the player instead: a tap for
  // the two pointing cards, one of the watchers below for the route and the free board, and
  // nothing at all for the end.
  useEffect(() => {
    if (!active) return
    const hold = LESSON_HOLD_MS[step]
    if (hold === null) return
    const timer = setTimeout(advance, hold)
    return () => {
      clearTimeout(timer)
    }
  }, [step, active, advance])

  // A hit landing, spotted the way the coach spots one: a batch sequence that has moved.
  // The machine's own hit count goes with it, because the swipe lesson counts targets and
  // this is the number that already does.
  const lastSeq = useRef(batch.seq)
  useEffect(() => {
    if (batch.seq === lastSeq.current) return
    lastSeq.current = batch.seq
    if (!active || batch.hits.length === 0) return
    setStep((current) => lessonStep(current, { type: 'HIT', hits }))
  }, [batch, hits, active])

  const chasing = targets[0]?.value

  // The key the route is owed next, while the route is what is being taught. Recomputed
  // from the board rather than planned once and followed, so a press that went somewhere
  // unexpected — the lit key swiped rather than tapped — is answered by the next key
  // rather than by a script that has lost its place.
  const dial: LessonDial = active ? LESSON_DIAL[step] : 'all'
  const liveKey = useMemo(() => {
    if (dial !== 'one' || chasing === undefined) return null
    return computeKeyPlan(grid, chasing)[0]?.index ?? null
  }, [dial, grid, chasing])

  const line: MessageDescriptor | null = active ? LESSON_LINE[step] : null
  const voice: LessonVoice = active ? LESSON_VOICE[step] : 'silent'

  return {
    // What is being said, and where it is drawn. `silent` draws nothing.
    voice,
    line,
    // What the dial will take, and — while it will take one key only — which.
    dial,
    liveKey,
    // A tap anywhere moves the lesson on, but only while it is holding the player up.
    // Null everywhere else, which is also how the screen knows whether to catch taps.
    onTapThrough: active && dismissedByTap(step) ? advance : null,
    // Told about every press and every key set outright. What they are listening for are the
    // three swipes that end the three lessons no clock does.
    notePress,
    noteSet,
  }
}
