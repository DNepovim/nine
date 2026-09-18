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

// The app's own dark ink (global.css's --color-primary, DIAL_COLORS' light text) —
// used here rather than a light ink because it's the one tone that reads on every
// accent colour the tutorial's screens wear, badge to badge: white drops as low as
// ~3.4:1 on the warmer stops, this stays above 4:1 clear across all of them.
const INK = '#1C1928'

// The one thing the player has to do right now. Flips to a tick once done, so the
// screen always says whether Next is waiting on them.
//
// `action` is the gesture named on its own — "SWIPE RIGHT" — set apart on its own
// line, in the app's caps, so the instruction reads before the reason does. Screens
// with nothing to name pass text alone, which then carries the colour itself.
//
// The colour shows up several times over rather than once: the edge stripe marks
// the callout out from the page at a glance, the icon sits in the same wash as the
// callout itself rather than a badge of its own, and the action chip — the thing
// to actually do — is the one place the colour goes solid, with dark ink on top.
// Detail stays dim, a reason rather than an instruction, but still bold: this is a
// callout, not a caption, and both its lines should read as said with confidence.
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
          style={{ backgroundColor: `${color}17` }}
        >
          <Ionicons name={icon()} size={18} color={color} />
        </View>
        <View className="flex-1">
          {hasAction && (
            <View
              className="mb-0.5 self-start rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: color }}
            >
              <Text
                selectable={false}
                className="font-mono text-[12.5px] font-black tracking-[1.5px]"
                style={{ color: INK }}
              >
                {action}
              </Text>
            </View>
          )}
          <Text
            selectable={false}
            className={cn(
              'font-mono text-[12px] font-bold leading-[18px]',
              // Primary, not dim. The card is the lesson's colour at 9% over the
              // surface, and `dim` on that is 1.9:1 in light and 2.3:1 in dark — a
              // rendering of the one sentence that says what to do, in a tone meant for
              // asides. Primary takes it to 13.7:1 and 12.4:1 and matches the heading
              // sentence directly above, which made the same call for the same reason.
              //
              // Primary rather than a darker grey on purpose: darker only reads as more
              // contrast in the light theme — in dark it is the wrong direction, and
              // this token inverts where a hex would not.
              hasAction && 'text-primary',
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
