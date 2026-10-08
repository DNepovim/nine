import { useEffect, useRef } from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

// A box's digit landing — the same pop-and-settle a dial key's tap gets
// (`dial-button.tsx`'s `animateTap`), so a typed code reads as a run of presses rather
// than text appearing. Module-level so remounting the input never remounts this, per the
// app's Reanimated convention.
//
// Shared by the two places the app draws a code as framed boxes: the four digits of a room
// code, typed on a keypad of ours, and the six of a profile code, typed on the phone's own.
// One component because a digit landing should look the same in both — they are the same
// gesture, and the second one arriving with no pop would read as a different app.
export function CodeDigit({
  digit,
  color,
  // How big the digit is drawn. The room code has a row of four to fill and can afford the
  // larger size; the profile code has six inside a dialog and cannot.
  size,
}: {
  digit: string
  color: string
  size: number
}) {
  const prevDigit = useRef(digit)
  const scale = useSharedValue(digit ? 1 : 0.5)
  const opacity = useSharedValue(digit ? 1 : 0)

  useEffect(() => {
    // Only a fill pops in — clearing a box (backspace) snaps quiet, since the
    // keyboard's own key press already carries that action's feedback.
    if (digit === prevDigit.current || !digit) {
      prevDigit.current = digit
      if (!digit) {
        scale.value = 0.5
        opacity.value = 0
      }
      return
    }
    prevDigit.current = digit
    opacity.value = withTiming(1, { duration: 90 })
    scale.value = withSequence(
      withTiming(1.2, { duration: 90 }),
      withSpring(1, { damping: 14, stiffness: 260 }),
    )
  }, [digit])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.Text
      selectable={false}
      className="font-mono font-black"
      style={[{ color, fontSize: size }, animStyle]}
    >
      {digit}
    </Animated.Text>
  )
}
