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
  const trackColor = backgroundColor ?? (isDark ? '#2A2B44' : '#D4D0C8')

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
    strokeDashoffset: circumference * (1 - progress.value),
  }))

  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
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
