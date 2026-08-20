import type { ComponentType } from 'react'
import { View } from 'react-native'

import { ControlsLesson } from '@/components/overlays/tutorial/lessons/controls-lesson'
import { GoalLesson } from '@/components/overlays/tutorial/lessons/goal-lesson'
import { ModesLesson } from '@/components/overlays/tutorial/lessons/modes-lesson'
import { StrategyLesson } from '@/components/overlays/tutorial/lessons/strategy-lesson'
import { TipsLesson } from '@/components/overlays/tutorial/lessons/tips-lesson'
import { WeightsLesson } from '@/components/overlays/tutorial/lessons/weights-lesson'
import { TutorialFooter } from '@/components/overlays/tutorial/tutorial-footer'
import { TutorialResumeButton } from '@/components/overlays/tutorial/tutorial-resume-button'
import { TutorialStepper } from '@/components/overlays/tutorial/tutorial-stepper'
import { STEP_CTA, type TutorialStepId } from '@/constants/tutorial'
import type { TutorialMode } from '@/hooks/use-tutorial'
import type { LessonProps } from '@/types/tutorial'

const LESSONS = {
  goal: GoalLesson,
  controls: ControlsLesson,
  weights: WeightsLesson,
  strategy: StrategyLesson,
  modes: ModesLesson,
  tips: TipsLesson,
} as const satisfies Record<TutorialStepId, ComponentType<LessonProps>>

const DISMISS_LABEL = {
  gated: 'SKIP TUTORIAL',
  review: 'CLOSE',
} as const satisfies Record<TutorialMode, string>

export function TutorialOverlay({
  isDark,
  mode,
  step,
  stepId,
  showNext,
  canResume,
  resumeStep,
  isLast,
  onPrev,
  onNext,
  onResume,
  onSelectStep,
  onStepDone,
  onDismiss,
}: {
  isDark: boolean
  mode: TutorialMode
  step: number
  stepId: TutorialStepId
  showNext: boolean
  canResume: boolean
  resumeStep: number
  isLast: boolean
  onPrev: () => void
  onNext: () => void
  onResume: () => void
  onSelectStep: (index: number) => void
  onStepDone: () => void
  onDismiss: () => void
}) {
  const Lesson = LESSONS[stepId]

  // px-4 mirrors Screen, so a lesson's dial lands where the game's does.
  return (
    <View className="absolute inset-0 bg-surface px-4 pb-2 pt-14" style={{ zIndex: 30 }}>
      <TutorialStepper step={step} onSelect={onSelectStep} />

      {canResume && <TutorialResumeButton step={resumeStep} onPress={onResume} />}

      <TutorialFooter
        isFirst={step === 0}
        isLast={isLast}
        showNext={showNext}
        nextLabel={STEP_CTA[stepId]}
        dismissLabel={DISMISS_LABEL[mode]}
        onPrev={onPrev}
        onNext={onNext}
        onDismiss={onDismiss}
      />

      {/* Keyed so each screen starts from a clean dial. */}
      <Lesson key={stepId} isDark={isDark} onComplete={onStepDone} />
    </View>
  )
}
