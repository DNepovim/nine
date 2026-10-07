import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { mapLabel } from '@/constants/theme'
import { tiltedAt, type Sheet } from '@/lib/arcade-tilt'

// The name of the place the hero has just reached, under the flame.
//
// A moment rather than a label: the top bar carries the name for as long as you stand
// there, and this is the arriving. It is the handover from the bud — the name was under a
// disc a second ago, and now it is under your feet.
//
// Mounted per crossroad, keyed on the crossroad's id by the screen, so each arrival plays
// once and the next one is a fresh one rather than a view restarting.

const IN_MS = 220
const HOLD_MS = 900
const OUT_MS = 420

// How far below the crossroad it sits. The flame rises from that point, so this is clear of
// it — and it is over the way the hero came up, which is the one thing on the sheet worth
// covering for a second.
const DROP = 20
const RISE = 5

export function VillageArrival({
  x,
  y,
  name,
  sheet,
  ink,
}: {
  x: number
  y: number
  name: string
  // The camera. Its turn is taken back out and its tilt is not taken at all: a name is read
  // rather than drawn, so it is set at one size wherever on the sheet it is called out —
  // what the tilt moves is where it is called out, which is the ground the hero stands on.
  sheet: SharedValue<Sheet>
  ink: string
}) {
  const opacity = useSharedValue(0)
  const lift = useSharedValue(RISE)

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: IN_MS }),
      withDelay(HOLD_MS, withTiming(0, { duration: OUT_MS })),
    )
    lift.value = withTiming(0, {
      duration: IN_MS + 120,
      easing: Easing.out(Easing.cubic),
    })
  }, [])

  const style = useAnimatedStyle(() => {
    const lie = tiltedAt(sheet.value, x, y)
    return {
      opacity: opacity.value,
      transform: [
        { translateX: lie.x - x },
        { translateY: lie.y - y + lift.value },
        { rotate: `${-sheet.value.turn}rad` },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - 70, top: y + DROP, width: 140 }, style]}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        // The map's own lettering, at the size a called-out place is set in.
        className="text-center text-[12px] font-semibold tracking-[2.5px]"
        style={{ color: ink, fontFamily: mapLabel }}
      >
        {name.toUpperCase()}
      </Text>
    </Animated.View>
  )
}
