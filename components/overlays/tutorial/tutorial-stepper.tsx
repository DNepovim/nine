import { Pressable, View } from 'react-native'

import {
  segmentState,
  TutorialStepSegment,
} from '@/components/overlays/tutorial/tutorial-step-segment'
import { STEP_COLORS, TUTORIAL_STEPS } from '@/constants/tutorial'

// One segment per screen, filling with the mode spectrum as the player advances.
// Each is tappable, so the stepper doubles as a jump-to-screen control; the
// padding gives the 6px bars a thumb-sized target.
export function TutorialStepper({
  step,
  onSelect,
}: {
  step: number
  onSelect: (index: number) => void
}) {
  return (
    <View className="flex-row gap-1.5">
      {TUTORIAL_STEPS.map((id, index) => (
        <Pressable
          key={id}
          className="flex-1 justify-center py-2"
          onPress={() => {
            onSelect(index)
          }}
        >
          <TutorialStepSegment
            color={STEP_COLORS[index] ?? '#4C7EFF'}
            state={segmentState(index, step)}
          />
        </Pressable>
      ))}
    </View>
  )
}
