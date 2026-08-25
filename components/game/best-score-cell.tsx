import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

// The mark hangs off the cell's own top-right, which is the number's top-right — the
// label sits to the left, so nothing else is over there. Being absolute is the point:
// a mark in the flow would widen the cell as it appeared, and the row is spaced with
// `justify-between`, so one record changing hands would shuffle all four scores.
const MARK_TOP = -2
const MARK_RIGHT = -8

// Deliberately not the seven-segment face the number wears: DSEG7 draws digits from
// segments and has no asterisk to draw.
const MARK = '*'

// A slow breathe rather than a flash — this sits beside three other still numbers, and
// anything faster would read as an error state instead of a nudge.
const PULSE_MS = 700
const PULSE_SCALE = 1.14

// One label + number pair in the best-scores line. The label stays in the shared
// dim ink; the number carries its own colour from the game spectrum so the four
// scores stay tellable apart at a glance.
//
// A record the player holds is marked rather than recoloured: the number's colour is
// what says which period it belongs to, and spending that on ownership would leave two
// gold cells that no longer read as different boards.
export function BestScoreCell({
  label,
  value,
  color,
  digitFont,
  mine = false,
  mineColor,
  pulsing = false,
}: {
  label: string
  value: number
  color: string
  digitFont: string
  // Whether this board's record is the player's own.
  mine?: boolean
  // Gold that reads as text on the active theme — see GOLD_INK.
  mineColor?: string
  // Whether the live score is close enough to this bar to nudge the player toward it —
  // see lib/near-record.ts. Never true on more than one cell at once, since only the
  // tightest gap counts as close.
  pulsing?: boolean
}) {
  const scale = useSharedValue(1)

  useEffect(() => {
    if (!pulsing) {
      scale.value = withTiming(1, { duration: PULSE_MS / 2 })
      return
    }
    scale.value = withRepeat(
      withTiming(PULSE_SCALE, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [pulsing, scale])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View className="flex-row items-baseline gap-1">
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
        {label}
      </Text>
      <Animated.Text
        selectable={false}
        numberOfLines={1}
        className="text-[10px] tracking-[1px]"
        style={[{ fontFamily: digitFont, color }, pulseStyle]}
      >
        {value}
      </Animated.Text>
      {mine && (
        <Text
          selectable={false}
          className="absolute font-mono text-[10px] font-bold"
          style={{ top: MARK_TOP, right: MARK_RIGHT, color: mineColor }}
        >
          {MARK}
        </Text>
      )}
    </View>
  )
}
