import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { TUTORIAL_KEY } from '@/constants/storage'
import {
  AUTO_ADVANCE_MS,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STEPS,
  type TutorialStepId,
} from '@/constants/tutorial'
import { clampStep, parseTutorialDone, serializeTutorialDone } from '@/lib/tutorial'

// The guide, opened from How to Play and nowhere else.
//
// It used to let itself in on a first launch and gate its own screens until each one's
// task was done. A first launch drops straight into a Trainee run now (hooks/use-welcome.ts),
// so every visit here is a visit the player asked for — which is why there is nothing to
// gate, nothing to resume, and no stored step: somebody browsing a guide on purpose can
// be trusted with the forward button.
export function useTutorial() {
  const [visible, setVisible] = useState(false)
  // Whether the player is done with the guide — reached the end, or decided they had seen
  // enough. The stored flag does not tell the two apart, and nothing in the app has ever
  // needed it to: `dismiss` is the one way out, whichever screen it was called from.
  const [finished, setFinished] = useState(false)
  const [step, setStep] = useState(0)
  const [doneSteps, setDoneSteps] = useState<readonly number[]>([])

  // Hydrate once, for the one bit worth keeping. A read failure leaves it false, which at
  // worst withholds an achievement the next visit will hand over anyway.
  useEffect(() => {
    void (async () => {
      try {
        setFinished(parseTutorialDone(await AsyncStorage.getItem(TUTORIAL_KEY)))
      } catch {
        // ignore — not been through it
      }
    })()
  }, [])

  const goTo = useCallback((next: number) => {
    const clamped = clampStep(next)
    setStep(clamped)
    // Completion is per visit. Without this a screen cleared earlier would still count as
    // done the moment you arrive back on it, and the auto-advance below would bounce you
    // straight off again.
    setDoneSteps((prev) => prev.filter((index) => index !== clamped))
  }, [])

  const open = useCallback(() => {
    setStep(0)
    setDoneSteps([])
    setVisible(true)
  }, [])

  // Closing and finishing both land here: the guide is done with, so the flag goes in.
  const dismiss = useCallback(() => {
    AsyncStorage.setItem(TUTORIAL_KEY, serializeTutorialDone(true)).catch(() => {})
    setFinished(true)
    setVisible(false)
  }, [])

  const markStepDone = useCallback((index: number) => {
    setDoneSteps((prev) => (prev.includes(index) ? prev : [...prev, index]))
  }, [])

  const stepId: TutorialStepId = TUTORIAL_STEPS[step] ?? 'goal'
  const isLast = step === TUTORIAL_STEP_COUNT - 1

  // A screen that reports itself done carries the player forward anyway, forward button or
  // not: the opening screen has none of its own, and on the rest it saves a press that
  // would only confirm what the screen has just shown. The last screen stays put, ending
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

  return {
    visible,
    finished,
    step,
    stepId,
    isLast,
    open,
    dismiss,
    goTo,
    markStepDone,
  }
}
