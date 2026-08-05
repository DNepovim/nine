import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text } from 'react-native'

import { STEP_COLORS, TUTORIAL_STEP_COUNT } from '@/constants/tutorial'

// Shown on the first screen when a previous session left off further along:
// start over by simply reading on, or jump straight back to where you stopped.
export function TutorialResumeButton({
  step,
  onPress,
}: {
  step: number
  onPress: () => void
}) {
  const color = STEP_COLORS[step] ?? '#4C7EFF'
  return (
    <Pressable
      onPress={onPress}
      className="mt-3 flex-row items-center gap-2 rounded-xl px-4 py-2.5"
      style={{ backgroundColor: `${color}1F` }}
    >
      <Ionicons name="play-forward" size={14} color={color} />
      <Text
        selectable={false}
        className="flex-1 font-mono text-[11px] font-black tracking-[1px]"
        style={{ color }}
      >
        {`GO TO WHERE YOU LEFT OFF — STEP ${step + 1} OF ${TUTORIAL_STEP_COUNT}`}
      </Text>
    </Pressable>
  )
}
