import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

// The 5-dot cross every dialog closes with: four corners and a centre. Pressing it
// converges the dots on the centre and springs them back out.
//
// It used to be one button that morphed — a 3×3 grid labelled MENU during a run, this
// cross labelled CLOSE while paused — which is why the dots sit on grid coordinates at
// all. A run now has its own button in the top row (components/game/pause-button.tsx)
// and the pause screen is left through CONTINUE, so nothing asks for the grid any more
// and only the cross remains. The name has not caught up with that yet.

const DOT = 4

function MenuDot({
  collapse,
  baseX,
  baseY,
  dx,
  dy,
  color,
}: {
  // 0 = at its own corner, 1 = merged on the centre.
  collapse: SharedValue<number>
  baseX: number
  baseY: number
  dx: number
  dy: number
  color: string
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx * collapse.value }, { translateY: dy * collapse.value }],
  }))
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: baseX,
          top: baseY,
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

export function MenuButton({
  onToggle,
  color,
  size = 22,
  showLabel = true,
  style,
}: {
  onToggle: () => void
  color: string
  size?: number
  // Off where the surrounding UI already says what the button does — a dialog header
  // doesn't need the word CLOSE next to a close control.
  showLabel?: boolean
  style?: object
}) {
  const far = size - DOT
  const centre = far / 2
  const dots = [
    { x: 0, y: 0 },
    { x: far, y: 0 },
    { x: 0, y: far },
    { x: far, y: far },
    { x: centre, y: centre },
  ]
  const collapse = useSharedValue(0)

  const trigger = () => {
    collapse.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 340, easing: Easing.out(Easing.back(2)) }),
    )
    // Immediately, not at the peak of the squash: waiting 160ms for the animation left
    // whatever is behind the dialog running for those 160ms.
    onToggle()
  }

  return (
    <Pressable
      onPress={trigger}
      hitSlop={14}
      style={[style, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
    >
      {showLabel && (
        <Text
          selectable={false}
          // Secondary ink, not `muted`: muted is a hairline colour and put this label at
          // about 1.3:1 on the light surface, which is a word you can only find by
          // knowing it is there.
          className="font-mono text-[14px] font-black tracking-[3px] text-dim"
        >
          CLOSE
        </Text>
      )}
      <View style={{ width: size, height: size }}>
        {dots.map((dot) => (
          <MenuDot
            key={`${dot.x}-${dot.y}`}
            collapse={collapse}
            baseX={dot.x}
            baseY={dot.y}
            dx={centre - dot.x}
            dy={centre - dot.y}
            color={color}
          />
        ))}
      </View>
    </Pressable>
  )
}
