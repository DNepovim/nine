import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

// A single persistent button that morphs between the 3×3 grid (playing) and a
// 5-dot cross of center + corners (paused). Tapping converges every dot to the
// center, toggles pause at the peak, then springs the shape back out — so the
// same element stays in place across the game/pause transition.

function MenuDot({
  collapse,
  present,
  baseX,
  baseY,
  dx,
  dy,
  d,
  color,
}: {
  collapse: SharedValue<number>
  present: SharedValue<number> // 1 = at its position, 0 = merged + hidden at center
  baseX: number
  baseY: number
  dx: number
  dy: number
  d: number
  color: string
}) {
  const style = useAnimatedStyle(() => {
    // factor: 0 = at grid position, 1 = merged at the center dot.
    const factor = 1 - present.value * (1 - collapse.value)
    return {
      transform: [{ translateX: dx * factor }, { translateY: dy * factor }],
      opacity: present.value,
    }
  })
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: baseX,
          top: baseY,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

export function MenuButton({
  visible,
  paused,
  onToggle,
  color,
  size = 22,
  style,
}: {
  visible: boolean
  paused: boolean
  onToggle: () => void
  color: string
  size?: number
  style?: object
}) {
  const D = 4
  const coords = [0, (size - D) / 2, size - D]
  const center = (size - D) / 2
  const collapse = useSharedValue(0)
  // Edge dots are shown in the grid, merged+hidden at the center in the cross.
  const edge = useSharedValue(paused ? 0 : 1)
  const always = useSharedValue(1)

  useEffect(() => {
    edge.value = withTiming(paused ? 0 : 1, {
      duration: 300,
      easing: Easing.out(Easing.back(2)),
    })
  }, [paused])

  const trigger = () => {
    collapse.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 340, easing: Easing.out(Easing.back(2)) }),
    )
    setTimeout(onToggle, 160) // toggle at the peak; edges morph via the paused effect
  }

  if (!visible) return null
  return (
    <Pressable
      onPress={trigger}
      hitSlop={14}
      style={[style, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
    >
      <Text
        selectable={false}
        className="font-mono text-[14px] font-black tracking-[3px] text-muted"
      >
        {paused ? 'CLOSE' : 'MENU'}
      </Text>
      <View style={{ width: size, height: size }}>
        {coords.map((y, r) =>
          coords.map((x, c) => {
            const isEdge = (r === 1) !== (c === 1) // exactly one axis centered
            return (
              <MenuDot
                key={`${r}-${c}`}
                collapse={collapse}
                present={isEdge ? edge : always}
                baseX={x}
                baseY={y}
                dx={center - x}
                dy={center - y}
                d={D}
                color={color}
              />
            )
          }),
        )}
      </View>
    </Pressable>
  )
}
