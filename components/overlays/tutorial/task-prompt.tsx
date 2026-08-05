import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'

// The one thing the player has to do right now. Flips to a tick once done, so the
// screen always says whether Next is waiting on them.
export function TaskPrompt({
  text,
  done,
  color,
}: {
  text: string
  done: boolean
  color: string
}) {
  return (
    <View
      className="mt-4 flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
      style={{ backgroundColor: `${color}1F` }}
    >
      <Ionicons name={done ? 'checkmark-circle' : 'hand-left'} size={17} color={color} />
      <Text
        selectable={false}
        className="flex-1 font-mono text-[12px] font-bold leading-[18px]"
        style={{ color }}
      >
        {text}
      </Text>
    </View>
  )
}
