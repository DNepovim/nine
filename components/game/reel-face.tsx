import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

import { CASINO } from '@/constants/colors'
import { mono } from '@/constants/theme'

// What turns a key into the reel of a slot machine (a scheme's keys with `reel` set): a cylinder
// of cream with a column of digits turning on it, the one showing in the middle and its
// neighbours above and below — the one a raise will bring down above it, the one a lowering will
// bring up below it — peeking in at the top and foot, and a blur of digits as it spins.
//
// When the value changes the column rolls one place, so the neighbour that was above slides
// down into the middle as the old digit leaves out of the foot, and the other way for a lowering.
// A scramble does not roll; it spins (`spin`), and the column takes its new digit while it does.
//
// Drawn inside the key, over its fill and clipped to its shape. The key's own digit is not drawn
// where this is: it is the middle row here.

// How tall one row of the column is, against the key, and of the spinning blur.
const COLUMN = 0.55
const ROW = 0.8
// How many rows one lap of the blur has, which is how far it runs before it begins again.
const LAP = 3
// How many places either side of the one showing are drawn: the one in view and the one coming.
const REACH = 2

// Which way the column rolls for a change from `was` to `now` on a reel of `digits`: one for a
// raise, which brings the digit above down, and minus one for a lowering. A wrap round the ends is
// the raise or the lowering it is, not the long way.
function rollOf(was: number, now: number, digits: number): 1 | -1 {
  const step = (((now - was) % digits) + digits) % digits
  return step <= digits / 2 ? 1 : -1
}

export function ReelFace({
  value,
  digits,
  size,
  radius,
  spin,
  strip,
  scrambles,
}: {
  value: number
  digits: number
  size: number
  radius: number
  // Nought at rest and one while the reel spins, and how far round a lap of the blur it is.
  spin: SharedValue<number>
  strip: SharedValue<number>
  // How many scrambles the dial has had, so a change that came with one is a spin and no roll.
  scrambles: number
}) {
  const row = size * COLUMN
  const fontSize = size * 0.46
  const roll = useSharedValue(0)
  const before = useRef({ value, scrambles })

  useEffect(() => {
    const was = before.current
    before.current = { value, scrambles }
    if (value === was.value || scrambles !== was.scrambles) return
    // The column starts where it was — the old digit in the middle — and settles into its place.
    roll.value = -rollOf(was.value, value, digits) * row
    roll.value = withSpring(0, { damping: 16, stiffness: 150, mass: 0.7 })
  }, [value, scrambles])

  const column = useAnimatedStyle(() => ({
    opacity: 1 - spin.value,
    transform: [{ translateY: roll.value }],
  }))
  const blur = useAnimatedStyle(() => ({
    opacity: spin.value * 0.9,
    transform: [{ translateY: -strip.value * size * ROW * LAP }],
  }))
  // The blur's rows: three digits and the same three again, so a lap is seamless.
  const rows = [3, 7, 5, 3, 7, 5].map((step) => (value + step) % digits)
  const places = Array.from({ length: 2 * REACH + 1 }, (_, at) => at - REACH)
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, column]}
      >
        {places.map((place) => (
          <Text
            key={place}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: size / 2 - row / 2 - place * row,
              height: row,
              lineHeight: row,
              textAlign: 'center',
              fontFamily: mono,
              fontWeight: '900',
              fontSize: place === 0 ? size * 0.5 : fontSize * 0.8,
              color: CASINO.digitRed,
              opacity: place === 0 ? 1 : 0.4,
              ...(place === 0 && {
                textShadowColor: CASINO.digitEdge,
                textShadowOffset: { width: 0, height: 3 },
                textShadowRadius: 0,
              }),
            }}
          >
            {(((value + place) % digits) + digits) % digits}
          </Text>
        ))}
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, blur]}>
        {rows.map((digit, at) => (
          <Text
            key={at}
            style={{
              height: size * ROW,
              lineHeight: size * ROW,
              textAlign: 'center',
              fontFamily: mono,
              fontWeight: '900',
              fontSize,
              color: CASINO.digitRed,
              opacity: 0.55,
            }}
          >
            {digit}
          </Text>
        ))}
      </Animated.View>
      <LinearGradient
        colors={[
          CASINO.shade,
          'rgba(70, 52, 24, 0)',
          'rgba(70, 52, 24, 0)',
          CASINO.shade,
        ]}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  )
}
