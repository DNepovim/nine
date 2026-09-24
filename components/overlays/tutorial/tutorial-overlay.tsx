import type { ComponentType } from 'react'

import { ControlsLesson } from '@/components/overlays/tutorial/lessons/controls-lesson'
import { GoalLesson } from '@/components/overlays/tutorial/lessons/goal-lesson'
import { ModesLesson } from '@/components/overlays/tutorial/lessons/modes-lesson'
import { StrategyLesson } from '@/components/overlays/tutorial/lessons/strategy-lesson'
import { SwipeLesson } from '@/components/overlays/tutorial/lessons/swipe-lesson'
import { WeightsLesson } from '@/components/overlays/tutorial/lessons/weights-lesson'
import { TutorialFooter } from '@/components/overlays/tutorial/tutorial-footer'
import { TutorialStepper } from '@/components/overlays/tutorial/tutorial-stepper'
import { ScreenLayer } from '@/components/screen'
import { STEP_CTA, type TutorialStepId } from '@/constants/tutorial'
import type { LessonProps } from '@/types/tutorial'

const LESSONS = {
  goal: GoalLesson,
  controls: ControlsLesson,
  weights: WeightsLesson,
  strategy: StrategyLesson,
  swipe: SwipeLesson,
  modes: ModesLesson,
} as const satisfies Record<TutorialStepId, ComponentType<LessonProps>>

export function TutorialOverlay({
  isDark,
  step,
  stepId,
  isLast,
  onPrev,
  onNext,
  onSelectStep,
  onStepDone,
  onDismiss,
}: {
  isDark: boolean
  step: number
  stepId: TutorialStepId
  isLast: boolean
  onPrev: () => void
  onNext: () => void
  onSelectStep: (index: number) => void
  onStepDone: () => void
  onDismiss: () => void
}) {
  const Lesson = LESSONS[stepId]

  // px-4 mirrors Screen, so a lesson's dial lands where the game's does. Top padding
  // is lighter than it looks it should be: the stepper is the first thing on the
  // screen and, unlike a row of controls, a slim tap target sitting close to the
  // notch/status bar reads fine — the old pt-14 was leaving that whole strip empty.
  return (
    <ScreenLayer className="px-4 pb-2 pt-6">
      <TutorialStepper step={step} onSelect={onSelectStep} />

      <TutorialFooter
        isFirst={step === 0}
        isLast={isLast}
        nextLabel={STEP_CTA[stepId]}
        onPrev={onPrev}
        onNext={onNext}
        onDismiss={onDismiss}
      />

      {/* Keyed so each screen starts from a clean dial. */}
      <Lesson
        key={stepId}
        isDark={isDark}
        onComplete={onStepDone}
        onDismiss={onDismiss}
      />
    </ScreenLayer>
  )
}
