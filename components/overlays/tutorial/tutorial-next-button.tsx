import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text } from 'react-native'

// Forward, in the top bar beside BACK — see the note in tutorial-footer.tsx for why it
// lives there and not in the lesson. Only appears when there's nothing to fulfil: a
// screen with no task, an already-cleared screen being revisited, or a free-browse
// replay. Completing a task carries the player forward on its own.
//
// Small, to sit in a row with two other controls. The label names where it goes rather
// than saying "next", but as the destination alone: with the arrow beside it, "MODES →"
// is the whole sentence.
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
      className="mt-3 flex-row items-center justify-center gap-1.5 self-center rounded-xl bg-strong px-4 py-2.5"
    >
      <Text
        selectable={false}
        className="font-mono text-[11px] font-black tracking-[1px] text-on-strong"
      >
        {label}
      </Text>
      <Ionicons name={isLast ? 'play' : 'arrow-forward'} size={12} color="#d8d2f4" />
    </Pressable>
  )
}
