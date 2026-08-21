import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import type { ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'
import { cn } from '@/lib/cn'

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
// `action` is the gesture named on its own — "SWIPE RIGHT" — set apart on its own
// line, in the app's caps, so the instruction reads before the reason does. Screens
// with nothing to name pass text alone, which then carries the colour itself.
//
// The colour shows up three times over rather than once: the edge stripe marks the
// callout out from the page at a glance, the badge behind the icon gives it a seat
// to sit in, and the action line — the thing to actually do — is the only text
// wearing it. Detail stays dim, a reason rather than an instruction.
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

  const hasAction = action !== undefined && !done

  return (
    <Animated.View
      entering={FadeInDown.delay(170).duration(380)}
      className="mt-4 flex-row items-stretch overflow-hidden rounded-2xl"
      style={{ backgroundColor: `${color}17` }}
    >
      <View className="w-1" style={{ backgroundColor: color }} />
      <View className="flex-1 flex-row items-center gap-3 px-3.5 py-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}2E` }}
        >
          <Ionicons name={icon()} size={18} color={color} />
        </View>
        <View className="flex-1">
          {hasAction && (
            <Text
              selectable={false}
              className="font-mono text-[12.5px] font-black tracking-[1.5px]"
              style={{ color }}
            >
              {action}
            </Text>
          )}
          <Text
            selectable={false}
            className={cn(
              'font-mono text-[12px] leading-[18px]',
              hasAction ? 'mt-0.5 font-medium text-dim' : 'font-bold',
            )}
            style={hasAction ? undefined : { color }}
          >
            {text}
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}
