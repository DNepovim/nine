import { Ionicons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const TOGGLE_W = 72
const TOGGLE_H = 30
const PAD = 4
const KNOB = TOGGLE_H - PAD * 2
const TRAVEL = TOGGLE_W - KNOB - PAD * 2
const ICON = 12
const ICON_INSET = 8

// Straight across and back, easing out of one end and into the other. A timing curve
// rather than a spring on purpose: every spring soft enough to read as a swing also
// overshoots, and an overshoot here carries the knob past the end of the track and out
// of the pill. This eases at both ends and stops exactly where the track does.
const SWING_MS = 280
const SWING_EASING = Easing.inOut(Easing.sin)

export function ThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean
  onToggle: () => void
}) {
  const knobX = useSharedValue(isDark ? PAD + TRAVEL : PAD)

  useEffect(() => {
    knobX.value = withTiming(isDark ? PAD + TRAVEL : PAD, {
      duration: SWING_MS,
      easing: SWING_EASING,
    })
  }, [isDark, knobX])

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }))

  const iconDim = isDark ? '#504E6E' : '#AAA69E'
  const iconActive = isDark ? '#D8D2F4' : '#1C1928'

  return (
    <Pressable onPress={onToggle}>
      <View
        className="flex-row items-center self-center bg-card"
        style={{
          width: TOGGLE_W,
          height: TOGGLE_H,
          borderRadius: TOGGLE_H / 2,
        }}
      >
        {/* Moon — left */}
        <View
          style={{
            position: 'absolute',
            left: ICON_INSET,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="moon" size={ICON} color={isDark ? iconDim : iconActive} />
        </View>
        {/* Sun — right */}
        <View
          style={{
            position: 'absolute',
            right: ICON_INSET,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="sunny" size={ICON} color={isDark ? iconActive : iconDim} />
        </View>
        {/* Knob */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: isDark ? '#1C1D30' : '#FDFCFA',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
            },
            knobStyle,
          ]}
        />
      </View>
    </Pressable>
  )
}
