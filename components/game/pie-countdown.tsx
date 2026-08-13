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

import { APP_BLUE, APP_RED, TARGET_BAND_TRACK } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'
import { targetBand } from '@/lib/target-band'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// The arc never covers the whole circle, so a sliver of the band-tinted track shows
// even on a freshly spawned target. Without this the band cue would grow from nothing
// as the clock drains — absent exactly when the target is most worth reading.
const ARC_MAX = 0.9

const fontSizeForDigits = (value: number, scale: number): number => {
  const digits = String(value).length
  const base = digits >= 3 ? 36 : digits === 2 ? 50 : 58
  return Math.round(base * scale)
}

export function PieCountdown({
  value,
  isDark,
  active,
  duration,
  onComplete,
  size = PIE_SIZE,
  backgroundColor,
}: {
  value: number
  isDark: boolean
  active: boolean
  duration: number
  onComplete: () => void
  size?: number
  backgroundColor?: string
}) {
  const scale = size / PIE_SIZE
  const radius = size / 4
  const stroke = size / 2
  const circumference = 2 * Math.PI * radius

  const progress = useSharedValue(1) // 1 = full, 0 = empty
  // The multiplayer hit-flash owns the track while it lasts, so the band yields to it.
  const trackColor =
    backgroundColor ?? TARGET_BAND_TRACK[isDark ? 'dark' : 'light'][targetBand(value)]

  useEffect(() => {
    progress.value = withTiming(0, { duration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onComplete)
    })
  }, [])

  useEffect(() => {
    if (active) return
    cancelAnimation(progress)
  }, [active])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
  }))

  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
    opacity: 1 - progress.value,
  }))

  const cx = size / 2
  const cy = size / 2

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={APP_BLUE}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={APP_RED}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={redProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text
          selectable={false}
          numberOfLines={1}
          className="font-mono font-extrabold text-pie"
          style={{ fontSize: fontSizeForDigits(value, scale), includeFontPadding: false }}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}
