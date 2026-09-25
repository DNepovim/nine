import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { APP_BLUE, APP_RED, PIE_INK, TARGET_BAND_TRACK } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'
import { cn } from '@/lib/cn'
import { targetBand } from '@/lib/target-band'
import type { TargetExit } from '@/types/game'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// The arc never covers the whole circle, so a sliver of the band-tinted track shows
// even on a freshly spawned target. Without this the band cue would grow from nothing
// as the clock drains — absent exactly when the target is most worth reading.
const ARC_MAX = 0.9

// How long a target takes to leave, hit or lost. Both exits run on this one clock —
// and the card fades on it too — so the whole thing lands at once, and so a loss is
// never the quicker way off the board.
export const TARGET_EXIT_MS = 500

// The hit: the ring collapses under the number while the number swells out of it.
const HIT_RING_SCALE = 0.35
const HIT_NUMBER_SCALE = 1.7

// The loss: the colours go first — one quick beat in which the whole pie turns red and
// the numeral turns white — and only then is the number pressed flat into it.
const FAIL_COLOR_MS = 100
const FAIL_SQUASH = 0.06

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
  exit = null,
  startProgress = 1,
}: {
  value: number
  isDark: boolean
  active: boolean
  duration: number
  onComplete: () => void
  size?: number
  backgroundColor?: string
  // The target is leaving: stop the clock and play the exit it left by.
  exit?: TargetExit | null
  // Where the clock starts, as a fraction of `duration`. Full for every target that
  // spawns while the app is open; less for one put back from storage mid-clock, which
  // has to come back holding what it had left rather than a whole clock over again.
  // Read once, at mount — see lib/target-clock.ts.
  startProgress?: number
}) {
  const scale = size / PIE_SIZE
  const radius = size / 4
  const stroke = size / 2
  const circumference = 2 * Math.PI * radius

  const progress = useSharedValue(startProgress) // 1 = full, 0 = empty
  const ringScale = useSharedValue(1)
  const ringOpacity = useSharedValue(1)
  const numberScale = useSharedValue(1)
  const numberSquash = useSharedValue(1)
  // 0 = the clock's own colours, 1 = the red disc a lost target turns into.
  const failColor = useSharedValue(0)
  const failed = exit === 'failed'
  // The multiplayer hit-flash owns the track while it lasts, so the band yields to it.
  const trackColor =
    backgroundColor ?? TARGET_BAND_TRACK[isDark ? 'dark' : 'light'][targetBand(value)]
  const numberColor = PIE_INK[isDark ? 'dark' : 'light']

  // One effect for starting, stopping and starting again, because they are the same
  // thing: the clock always runs from wherever the arc currently stands.
  //
  // Going inactive cancels, which leaves `progress` frozen at the fraction of the
  // clock that was left — and cancelling reports `finished: false`, so a target frozen
  // at nothing does not expire. Coming back runs that remainder: the easing is linear,
  // so the time left is exactly the arc left, and a target that was a hair from
  // running out has a hair of clock when the run resumes. That is what makes pausing
  // cost nothing and give nothing.
  useEffect(() => {
    if (!active) {
      cancelAnimation(progress)
      return
    }
    // Read off the render thread rather than inside it — this is an effect, and it is
    // the only place that can know how much clock is left.
    const remaining = duration * progress.value
    progress.value = withTiming(
      0,
      { duration: remaining, easing: Easing.linear },
      (finished) => {
        if (finished) scheduleOnRN(onComplete)
      },
    )
  }, [active])

  // The two exits are the same length and opposite in every other way. A hit lets the
  // number out of the ring that was timing it; a loss buries it in one — the clock's
  // colours go, the disc turns red, and the number is pressed flat into it.
  useEffect(() => {
    if (exit === null) return
    if (exit === 'hit') {
      ringScale.value = withTiming(HIT_RING_SCALE, {
        duration: TARGET_EXIT_MS,
        easing: Easing.in(Easing.quad),
      })
      numberScale.value = withTiming(HIT_NUMBER_SCALE, {
        duration: TARGET_EXIT_MS,
        easing: Easing.out(Easing.quad),
      })
      return
    }
    failColor.value = withTiming(1, {
      duration: FAIL_COLOR_MS,
      easing: Easing.out(Easing.quad),
    })
    ringOpacity.value = withTiming(0, {
      duration: TARGET_EXIT_MS,
      easing: Easing.in(Easing.quad),
    })
    numberSquash.value = withTiming(FAIL_SQUASH, {
      duration: TARGET_EXIT_MS,
      easing: Easing.in(Easing.quad),
    })
  }, [exit])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
  }))

  const redProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value * ARC_MAX),
    opacity: 1 - progress.value,
  }))

  // The red comes over the pie rather than through it: one disc the exact size of the
  // ring, fading in across the track and both arcs at once, so what is left is a plain
  // red circle however much clock the target had on it.
  const failDiscStyle = useAnimatedStyle(() => ({
    opacity: failColor.value,
  }))

  // Only taken over once the target is lost — until then the `pie` token paints the
  // numeral, so a screen that retints the token still gets its way.
  const numberColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(failColor.value, [0, 1], [numberColor, '#FFFFFF']),
  }))

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }))

  // Squashed on its own axis rather than through `scale`, so the press reads as the
  // number being flattened where it stands and not as the whole thing shrinking.
  const numberStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: numberScale.value },
      { scaleY: numberScale.value * numberSquash.value },
    ],
  }))

  const cx = size / 2
  const cy = size / 2

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={ringStyle}>
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
        <Animated.View
          className="absolute inset-0 rounded-full"
          style={[{ backgroundColor: APP_RED }, failDiscStyle]}
        />
      </Animated.View>
      <Animated.View
        className="absolute inset-0 items-center justify-center"
        style={numberStyle}
      >
        <Animated.Text
          selectable={false}
          numberOfLines={1}
          className={cn('font-mono font-extrabold', !failed && 'text-pie')}
          style={[
            { fontSize: fontSizeForDigits(value, scale), includeFontPadding: false },
            failed && numberColorStyle,
          ]}
        >
          {value}
        </Animated.Text>
      </Animated.View>
    </View>
  )
}
