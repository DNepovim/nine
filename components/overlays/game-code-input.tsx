import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { CodeKeyboard } from './code-keyboard'

// A box's digit landing — the same pop-and-settle a dial key's tap gets
// (`dial-button.tsx`'s `animateTap`), so a typed code reads as a run of presses
// rather than text appearing. Module-level so remounting the input never remounts
// this, per the app's Reanimated convention.
function CodeDigit({ digit, color }: { digit: string; color: string }) {
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
      className="font-mono text-[28px] font-black"
      style={[{ color }, animStyle]}
    >
      {digit}
    </Animated.Text>
  )
}

// How long the boxes hold the red flash before the wrong code clears itself —
// long enough to register as "that was rejected", short enough that the keyboard
// feels responsive again rather than locked.
const WRONG_CLEAR_DELAY_MS = 300
const WRONG_COLOR = '#E5534B'

export function GameCodeInput({
  value,
  onChange,
  accentColors,
  joinError,
}: {
  value: string
  onChange: (v: string) => void
  accentColors: [string, string]
  joinError: string | null
}) {
  const accentColor = accentColors[0]
  const [wrong, setWrong] = useState(false)
  const prevJoinError = useRef(joinError)

  // A join failure — not just any non-null error, a *new* one — flashes the boxes
  // red and clears itself. `menuOverlay` leaves the code on screen after the 4th
  // digit rather than clearing it (see its own comment), so this is what retires it.
  useEffect(() => {
    if (joinError === prevJoinError.current) return
    prevJoinError.current = joinError
    if (joinError === null) return
    setWrong(true)
    const timer = setTimeout(() => {
      setWrong(false)
      onChange('')
    }, WRONG_CLEAR_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [joinError, onChange])

  return (
    <View className="mb-8 mt-4 items-center">
      <Text
        selectable={false}
        className="mb-4 font-mono text-[9px] font-bold tracking-[2.5px] text-dim"
      >
        JOIN WITH CODE
      </Text>
      <View className="flex-row gap-3">
        {[0, 1, 2, 3].map((i) => {
          const digit = value[i] ?? ''
          const color = wrong ? WRONG_COLOR : digit ? accentColor : '#aaa69e40'
          return (
            <View
              key={i}
              className="w-13 h-17 border-2 rounded-[10px] items-center justify-center"
              style={{
                borderColor: wrong
                  ? WRONG_COLOR + 'CC'
                  : digit
                    ? accentColor + '80'
                    : '#aaa69e40',
                backgroundColor: wrong
                  ? WRONG_COLOR + '1F'
                  : digit
                    ? accentColor + '12'
                    : undefined,
              }}
            >
              <CodeDigit digit={digit} color={color} />
            </View>
          )
        })}
      </View>
      {joinError !== null ? (
        <Text
          selectable={false}
          className="mt-3 font-mono text-[10px] font-bold tracking-[1px]"
          style={{ color: '#E5534B' }}
        >
          {joinError}
        </Text>
      ) : (
        <View className="h-7" />
      )}
      <CodeKeyboard value={value} onChange={onChange} accentColors={accentColors} />
    </View>
  )
}
