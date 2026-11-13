import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

// The shot crossing the ground: a stone lobbed in an arc, or an arrow sent flat and fast.
//
// Both travel from the hero to wherever the blow landed, and both are gone the moment they
// arrive — what is left behind is the dust or the blood, which is a part of its own.
export function SiegeShot({
  clock,
  span,
  toX,
  toY,
  fromY,
  arc,
  turn,
  children,
}: {
  clock: SharedValue<number>
  // The stretch of the blow's clock the flight takes.
  span: number
  toX: number
  toY: number
  fromY: number
  arc: number
  // Whether the shot turns to point the way it is going. A stone tumbles; an arrow does not.
  turn: boolean
  children: React.ReactNode
}) {
  const flying = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, clock.value / span))
    const x = toX * k
    const y = fromY + (toY - fromY) * k - Math.sin(k * Math.PI) * arc
    // The angle of the line the shot is actually on right now, which for an arrow is the
    // way it points and for a stone is the way it spins.
    const lean = turn
      ? Math.atan2(toY - fromY - Math.cos(k * Math.PI) * Math.PI * arc, toX)
      : k * 7
    return {
      // Gone as it arrives rather than at the moment it does: what takes over is the dust
      // or the blood, and a shot that blinked out would read as a frame dropped.
      opacity: Math.min(1, (1 - k) * 8),
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${lean}rad` }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }, flying]}
    >
      {children}
    </Animated.View>
  )
}
