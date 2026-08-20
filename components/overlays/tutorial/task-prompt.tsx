import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'

import type { ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'

type IoniconName = keyof typeof Ionicons.glyphMap

// The icon points the way the gesture goes, so the callout says which direction
// before any of it is read. Tap has no direction — it gets the press target instead.
const GESTURE_ICON = {
  tap: 'radio-button-on',
  down: 'arrow-down',
  right: 'arrow-forward',
  left: 'arrow-back',
} as const satisfies Record<ThumbGesture, IoniconName>

// A screen with no particular gesture to demonstrate: taps on a named button, or a
// target to reach. The open hand is the generic "your turn".
const NEUTRAL_ICON = 'hand-left'

// The one thing the player has to do right now. Flips to a tick once done, so the
// screen always says whether Next is waiting on them.
//
// `action` is the gesture named on its own — "SWIPE RIGHT" — set in the app's caps
// so the instruction is legible at a glance and the sentence after it is the reason
// rather than the instruction. Screens with nothing to name pass text alone.
export function TaskPrompt({
  text,
  action,
  gesture,
  done,
  color,
}: {
  text: string
  action?: string
  gesture?: ThumbGesture
  done: boolean
  color: string
}) {
  const icon = (): IoniconName => {
    if (done) return 'checkmark-circle'
    if (gesture === undefined) return NEUTRAL_ICON
    return GESTURE_ICON[gesture]
  }

  return (
    <View
      className="mt-4 flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
      style={{ backgroundColor: `${color}1F` }}
    >
      <Ionicons name={icon()} size={17} color={color} />
      <Text
        selectable={false}
        className="flex-1 font-mono text-[12px] font-bold leading-[18px]"
        style={{ color }}
      >
        {action !== undefined && !done && (
          <Text className="font-mono text-[12px] font-black tracking-[1px]">
            {`${action} `}
          </Text>
        )}
        {text}
      </Text>
    </View>
  )
}
