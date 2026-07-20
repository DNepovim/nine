import { Ionicons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const TOGGLE_W = 96
const TOGGLE_H = 40
const KNOB = TOGGLE_H - 8

export function ThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean
  onToggle: () => void
}) {
  const knobX = useSharedValue(isDark ? TOGGLE_W - KNOB - 4 : 4)

  useEffect(() => {
    knobX.value = withSpring(isDark ? TOGGLE_W - KNOB - 4 : 4, {
      damping: 18,
      stiffness: 200,
    })
  }, [isDark])

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
            left: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="moon" size={15} color={isDark ? iconDim : iconActive} />
        </View>
        {/* Sun — right */}
        <View
          style={{
            position: 'absolute',
            right: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="sunny" size={15} color={isDark ? iconActive : iconDim} />
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
