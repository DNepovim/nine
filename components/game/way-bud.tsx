import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { BUD_SIZE, WALK_MS, WITHER_MS } from '@/constants/arcade'

// The target at a way's end.
//
// A disc on the card colour with the numeral in the countdown's own ink, rather than in the
// amber the way is drawn in: amber on the parchment surface is about 2:1, so arcade's colour
// may be the line and the edge but never the number. It is the same pairing every target in
// the game is read off, which is the point — the dial answers this the way it answers any
// other target.
//
// No clock on it. The crossroad has one clock for all of its ways, drawn on the way behind
// the hero, so a bud is only ever a number.

export type BudState = 'growing' | 'withering' | 'absorbing'

export function WayBud({
  x,
  y,
  value,
  state,
  delay,
  edge,
  ink,
}: {
  x: number
  y: number
  value: number
  state: BudState
  delay: number
  edge: string
  ink: string
}) {
  const scale = useSharedValue(state === 'growing' ? 0 : 1)
  const opacity = useSharedValue(state === 'growing' ? 0 : 1)

  useEffect(() => {
    if (state === 'growing') {
      scale.value = withDelay(delay, withSpring(1, { damping: 13, stiffness: 190 }))
      opacity.value = withDelay(delay, withTiming(1, { duration: 200 }))
      return
    }
    // Refused: gone with the way it was hung on.
    if (state === 'withering') {
      scale.value = withTiming(0, { duration: WITHER_MS, easing: Easing.in(Easing.quad) })
      opacity.value = withTiming(0, { duration: WITHER_MS })
      return
    }
    // Chosen: it shrinks away over exactly the walk, so it is gone at the moment the hero
    // lands on it. A bud the hero reaches was never a thing to collect — it is the next
    // crossroad, and this is it becoming one.
    scale.value = withTiming(0, { duration: WALK_MS, easing: Easing.in(Easing.quad) })
    opacity.value = withDelay(WALK_MS * 0.55, withTiming(0, { duration: WALK_MS * 0.45 }))
  }, [state, delay])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center rounded-full bg-card"
      style={[
        {
          left: x - BUD_SIZE / 2,
          top: y - BUD_SIZE / 2,
          width: BUD_SIZE,
          height: BUD_SIZE,
          borderWidth: 1.5,
          borderColor: edge,
        },
        style,
      ]}
    >
      <Text
        selectable={false}
        className="font-mono text-[12px] font-black"
        style={{ color: ink }}
      >
        {value}
      </Text>
    </Animated.View>
  )
}
