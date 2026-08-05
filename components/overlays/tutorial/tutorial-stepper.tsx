import { View } from 'react-native'

import {
  segmentState,
  TutorialStepSegment,
} from '@/components/overlays/tutorial/tutorial-step-segment'
import { STEP_COLORS, TUTORIAL_STEPS } from '@/constants/tutorial'

// One segment per screen, filling with the mode spectrum as the player advances.
export function TutorialStepper({ step }: { step: number }) {
  return (
    <View className="flex-row gap-1.5">
      {TUTORIAL_STEPS.map((id, index) => (
        <TutorialStepSegment
          key={id}
          color={STEP_COLORS[index] ?? '#4C7EFF'}
          state={segmentState(index, step)}
        />
      ))}
    </View>
  )
}
