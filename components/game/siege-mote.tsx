import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

// One puff of dust, or one drop of blood: a disc thrown out of the point of impact, growing
// as it goes and gone by the time it stops.
//
// Module level, like every animated sub-component in this app — one defined inside a render
// is remounted on every frame its parent draws.
export function SiegeMote({
  clock,
  from,
  to,
  angle,
  reach,
  rise,
  size,
  grow,
  color,
  opacity,
}: {
  // The blow's own clock, nought to one over `BLOW_MS`.
  clock: SharedValue<number>
  // The stretch of that clock this mote lives over.
  from: number
  to: number
  angle: number
  reach: number
  // How far the mote drifts up the sheet as it goes, over and above its own direction. Dust
  // rises; blood does not.
  rise: number
  size: number
  grow: number
  color: string
  opacity: number
}) {
  const drifting = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, (clock.value - from) / (to - from)))
    // Out fast and then slowing, which is what a thrown thing does.
    const out = 1 - (1 - k) * (1 - k)
    return {
      opacity: k <= 0 || k >= 1 ? 0 : opacity * (1 - k * k),
      transform: [
        { translateX: Math.cos(angle) * reach * out },
        { translateY: Math.sin(angle) * reach * out - rise * out },
        { scale: 0.35 + grow * out },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        drifting,
      ]}
    />
  )
}
