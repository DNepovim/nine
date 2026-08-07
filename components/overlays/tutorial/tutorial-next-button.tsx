import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text } from 'react-native'

// Rendered by each lesson wherever it reads naturally — at the end of the copy,
// in the targets area. Only appears when there's nothing to fulfil: a screen with
// no task, an already-cleared screen being revisited, or a free-browse replay.
// Completing a task carries the player forward on its own.
//
// The label names what's coming rather than saying "next", so the button reads
// as an invitation into the next screen.
export function TutorialNextButton({
  label,
  isLast,
  onPress,
}: {
  label: string
  isLast: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mt-5 flex-row items-center justify-center gap-2 self-center rounded-2xl bg-strong px-6 py-3.5"
    >
      <Text
        selectable={false}
        className="font-mono text-[12px] font-black tracking-[1.5px] text-on-strong"
      >
        {label}
      </Text>
      <Ionicons name={isLast ? 'play' : 'arrow-forward'} size={14} color="#d8d2f4" />
    </Pressable>
  )
}
