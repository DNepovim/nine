import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { APP_BLUE, APP_RED } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// Thick-stroke trick: radius = SIZE/4, strokeWidth = SIZE/2
// → stroke spans from center to edge, looks like a filled disc.
const PIE_RADIUS = PIE_SIZE / 4
const PIE_STROKE = PIE_SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS

const fontSizeForDigits = (value: number): number => {
  const digits = String(value).length
  if (digits >= 3) return 36
  if (digits === 2) return 50
  return 58
}

export function PieCountdown({
  value,
  isDark,
  active,
  duration,
  onComplete,
}: {
  value: number
  isDark: boolean
  active: boolean
  duration: number
  onComplete: () => void
}) {
  const progress = useSharedValue(1) // 1 = full, 0 = empty
  const trackColor = isDark ? '#2A2B44' : '#D4D0C8'

  useEffect(() => {
    progress.value = withTiming(0, { duration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onComplete)
    })
  }, [])

  useEffect(() => {
    if (active) return
    cancelAnimation(progress)
  }, [active])

  // strokeDashoffset 0 = full disc, CIRCUMFERENCE = empty.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }))

  // A red arc layered over the blue one, fading in as time runs out (progress
  // 1 → 0). Uses only numeric animated props (opacity), which animate reliably
  // on SVG across platforms — unlike an animated `stroke` color string.
  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
    opacity: 1 - progress.value,
  }))

  const cx = PIE_SIZE / 2
  const cy = PIE_SIZE / 2

  return (
    <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
      <Svg width={PIE_SIZE} height={PIE_SIZE}>
        {/* Track disc */}
        <Circle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={trackColor}
          strokeWidth={PIE_STROKE}
          fill="none"
        />
        {/* Progress disc (blue) — rotated so it starts at 12 o'clock */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={APP_BLUE}
          strokeWidth={PIE_STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
        {/* Red arc over the blue one, fading in as the timer runs out */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={PIE_RADIUS}
          stroke={APP_RED}
          strokeWidth={PIE_STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={redProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      {/* Number centered — high-contrast against the blue/red disc and track */}
      <View className="absolute inset-0 items-center justify-center">
        <Text
          selectable={false}
          numberOfLines={1}
          className="font-mono font-extrabold text-pie"
          style={{
            // Scale by digit count so the number fills almost the whole circle
            // (targets are 0..324, i.e. 1–3 digits) while staying on one line.
            fontSize: fontSizeForDigits(value),
            includeFontPadding: false,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}
