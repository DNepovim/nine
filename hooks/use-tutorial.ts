import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { TUTORIAL_KEY } from '@/constants/storage'
import {
  AUTO_ADVANCE_MS,
  STEP_SELF_ADVANCES,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STEPS,
  type TutorialStepId,
} from '@/constants/tutorial'
import {
  clampStep,
  FINISHED_PROGRESS,
  parseTutorialProgress,
  serializeTutorialProgress,
  tutorialLaunch,
  type TutorialProgress,
} from '@/lib/tutorial-progress'

// `gated` is the first-launch run: Next unlocks only once the screen's task is
// done. `review` is the replay from How to Play — free browsing, nothing stored.
export type TutorialMode = 'gated' | 'review'

export function useTutorial() {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<TutorialMode>('gated')
  const [step, setStep] = useState(0)
  // The furthest screen reached, including progress carried over from a previous
  // session. Everything before it is already cleared, so stepping back and
  // forward again must not re-lock Next.
  const [furthest, setFurthest] = useState(0)
  const [doneSteps, setDoneSteps] = useState<readonly number[]>([])
  // Where a half-finished run left off, offered as a jump on the first screen.
  // 0 means there's nothing to resume.
  const [resumeStep, setResumeStep] = useState(0)

  // Hydrate once. A read failure leaves the tutorial hidden: if storage is
  // unavailable we couldn't record a dismissal either, and forcing the tutorial
  // on every launch is worse than leaving it to the How to Play entry point.
  useEffect(() => {
    void (async () => {
      try {
        const progress = parseTutorialProgress(await AsyncStorage.getItem(TUTORIAL_KEY))
        if (tutorialLaunch(progress) === 'hidden') return
        // Always open on the first screen; a stored step becomes a jump offer.
        const reached = progress.step ?? 0
        setResumeStep(reached)
        setFurthest(reached)
        setVisible(true)
      } catch {
        // ignore — stay hidden
      }
    })()
  }, [])

  const persist = useCallback((progress: TutorialProgress) => {
    AsyncStorage.setItem(TUTORIAL_KEY, serializeTutorialProgress(progress)).catch(
      () => {},
    )
  }, [])

  const goTo = useCallback(
    (next: number) => {
      const clamped = clampStep(next)
      setStep(clamped)
      setFurthest((prev) => Math.max(prev, clamped))
      // Completion is per visit. Without this a screen cleared earlier would
      // still count as done the moment you arrive back on it, and the
      // auto-advance below would bounce you straight off again.
      setDoneSteps((prev) => prev.filter((index) => index !== clamped))
      // Only the gated run is resumable; a replay shouldn't rewrite progress.
      if (mode === 'gated') persist({ finished: false, step: clamped })
    },
    [mode, persist],
  )

  const openReview = useCallback(() => {
    setMode('review')
    setStep(0)
    setFurthest(0)
    setResumeStep(0)
    setDoneSteps([])
    setVisible(true)
  }, [])

  // Skipping, closing and finishing all land here: the tutorial is done with, so
  // the stored step goes away and the flag stays.
  const dismiss = useCallback(() => {
    persist(FINISHED_PROGRESS)
    setVisible(false)
  }, [persist])

  const markStepDone = useCallback((index: number) => {
    setDoneSteps((prev) => (prev.includes(index) ? prev : [...prev, index]))
  }, [])

  const stepId: TutorialStepId = TUTORIAL_STEPS[step] ?? 'goal'
  const isLast = step === TUTORIAL_STEP_COUNT - 1
  // A screen already cleared in an earlier visit — its task isn't a gate any more.
  const isRevisit = step < furthest

  // A screen that reports itself done carries the player forward. This runs in
  // review too: the opening screen has no forward button of its own, so without
  // it a replay would sit there once its target resolved. Holds on a revisit as
  // well, since goTo cleared the step — only the last screen stays put, ending
  // on its CTA instead.
  useEffect(() => {
    if (isLast) return
    if (!doneSteps.includes(step)) return
    const timer = setTimeout(() => {
      goTo(step + 1)
    }, AUTO_ADVANCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [isLast, doneSteps, step, goTo])

  // Shown only where there's nothing to fulfil: free-browse replay, a screen
  // without a task, or one the player has already cleared.
  const showNext = mode === 'review' || !STEP_SELF_ADVANCES[stepId] || isRevisit
  // Only worth offering while the player is still sitting on the first screen.
  const canResume = resumeStep > 0 && step === 0

  return {
    visible,
    mode,
    step,
    stepId,
    isLast,
    showNext,
    canResume,
    resumeStep,
    openReview,
    dismiss,
    goTo,
    markStepDone,
  }
}
