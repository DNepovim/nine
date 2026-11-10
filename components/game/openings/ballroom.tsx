import { useLingui } from '@lingui/react/macro'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { PARQUET } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { useViewport } from '@/hooks/use-viewport'
import { planksOf } from '@/lib/herringbone'
import type { OpeningTake } from '@/modes'

// HABIT's **opening**: a dance floor, and the count before the first step.
//
// The screen is the parquet's from the first frame, and what the scene does is bring the lights up
// on it: a veil of dark lifts as a spotlight sweeps across the floor, and then the count is given —
// ONE, TWO, THREE, CHA, CHA, one word to a beat, each alone and large in the middle of the targets'
// area — and the run starts on the second CHA. The scene draws nothing on the floor itself: it is
// the herringbone the run is played on (`ParquetRemains`), which stays behind it, and the
// footprints the run leaves are walked on it.
//
// The `short` take, for a run dealt again, is only the lights coming up — a player who has
// already been counted in does not need counting in twenty times.

const BEATS = {
  full: { wait: 200, lights: 1000, count: 2400, done: 4000, out: 350 },
  short: { wait: 0, lights: 380, count: 0, done: 520, out: 140 },
} as const satisfies Record<
  OpeningTake,
  { wait: number; lights: number; count: number; done: number; out: number }
>

// How dark the room is before the lights.
const VEIL = 0.8
// How much of a word's beat each of its two moves takes, and how far a word travels as it comes
// in and goes out.
const MOVE = 0.25
const RISE = 32
// The count is four beats: ONE, TWO and THREE take one each, and the two CHAs share the fourth, a
// half each — the cha-cha's quick pair. A word's `at` and `length`, below, are in beats.
const BEATS_IN_COUNT = 4

// How far down the screen the count stands, as a share of its height — the middle of the targets'
// area, which lies between the top bar and the dial.
const COUNT_AT = 0.3

// A pool of warm light, sweeping from one side of the floor to the other.
function Spotlight({
  lights,
  out,
}: {
  lights: SharedValue<number>
  out: SharedValue<number>
}) {
  const { width, height } = useViewport()
  const radius = width * 0.75
  const style = useAnimatedStyle(() => ({
    opacity: 1 - out.value,
    transform: [{ translateX: -radius + (width + radius) * lights.value }],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={[
        {
          position: 'absolute',
          left: 0,
          top: height * 0.3 - radius / 2,
          width: radius * 2,
        },
        style,
      ]}
    >
      <Svg width={radius * 2} height={radius * 2}>
        <Defs>
          <RadialGradient id="pool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={PARQUET.lamp} stopOpacity={0.5} />
            <Stop offset="1" stopColor={PARQUET.lamp} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill="url(#pool)" />
      </Svg>
    </Animated.View>
  )
}

// One word of the count. Only ever one is up: it rises into place and settles on its beat, holds, and
// lifts away before the next rises in, which is what makes the count read as a beat rather than
// a sentence. The first and last quarter of its beat are the two moves; the middle is held still.
function CountWord({
  word,
  at,
  length,
  count,
  out,
}: {
  word: string
  // Where its beat starts and how many beats it lasts.
  at: number
  length: number
  count: SharedValue<number>
  out: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => {
    const beat = (count.value - at) / length
    if (beat < 0 || beat >= 1) return { opacity: 0 }
    // How far in (nought to one over the beat's first quarter) and how far out (over its last).
    const rise = Math.min(1, beat / MOVE)
    const arrived = 1 - (1 - rise) ** 3
    const fall = Math.max(0, (beat - (1 - MOVE)) / MOVE)
    const left = fall ** 3
    return {
      opacity: arrived * (1 - left) * (1 - out.value),
      transform: [
        { translateY: (1 - arrived) * RISE - left * RISE },
        { scale: 1 + 0.3 * (1 - arrived) - 0.12 * left },
      ],
    }
  })
  return (
    <Animated.View className="absolute inset-x-0 items-center" style={style}>
      <Text className={TYPE.countIn} style={{ color: PARQUET.ink }}>
        {word}
      </Text>
    </Animated.View>
  )
}

export function Ballroom({ take, sweep, onSwitch, onDone }: OpeningSceneProps) {
  const { t } = useLingui()
  const beats = BEATS[take]
  const words = [
    { word: t`ONE`, at: 0, length: 1 },
    { word: t`TWO`, at: 1, length: 1 },
    { word: t`THREE`, at: 2, length: 1 },
    { word: t`CHA`, at: 3, length: 0.5 },
    { word: t`CHA`, at: 3.5, length: 0.5 },
  ]
  const { height } = useViewport()
  const lights = useSharedValue(0)
  const count = useSharedValue(0)
  const out = useSharedValue(0)

  useEffect(() => {
    sweep.value = 0
    lights.value = withDelay(
      beats.wait,
      withTiming(1, { duration: beats.lights, easing: Easing.inOut(Easing.quad) }),
    )
    sweep.value = withDelay(
      beats.wait,
      withTiming(1, { duration: beats.lights, easing: Easing.inOut(Easing.quad) }),
    )
    if (beats.count > 0) {
      // Linear, so every beat is the same length.
      count.value = withDelay(
        beats.wait + beats.lights,
        withTiming(BEATS_IN_COUNT, { duration: beats.count, easing: Easing.linear }),
      )
    }
    out.value = withDelay(beats.done - beats.out, withTiming(1, { duration: beats.out }))
    // The scheme is the floor's from the first frame; there is no screen to turn over.
    onSwitch()
    const done = setTimeout(onDone, beats.done)
    return () => {
      clearTimeout(done)
      // A skip lands here part-way. Whole, so the run starts on a lit floor.
      sweep.value = 1
    }
  }, [])

  const veil = useAnimatedStyle(() => ({
    opacity: VEIL * (1 - Math.min(1, lights.value * 1.25)),
  }))

  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <Spotlight lights={lights} out={out} />
      <Animated.View className="absolute inset-0 bg-black" style={veil} />
      {take === 'full' && (
        <View
          pointerEvents="none"
          className="absolute inset-x-0"
          style={{ top: height * COUNT_AT }}
        >
          {words.map((entry) => (
            <CountWord key={entry.at} {...entry} count={count} out={out} />
          ))}
        </View>
      )}
    </View>
  )
}

// How wide a plank is and how many times as long. Narrow enough to read as a floor on a phone, wide
// enough that the dial's keys are bigger than one.
const PLANK_WIDTH = 15
const PLANK_RATIO = 4
// The gap each plank leaves round itself, which is the seam.
const SEAM = 1

// A deterministic stain for a plank, so the same floor is drawn every time and no two neighbours
// are the same.
const stainOf = (index: number): number =>
  (index * 7 + (index >> 2)) % PARQUET.planks.length

// What the scene leaves behind: the herringbone floor, behind the targets and the dial. One path
// per stain rather than a view per plank — it is a thousand of them.
export function ParquetRemains() {
  const { width, height } = useViewport()
  const span = Math.hypot(width, height)
  const paths = PARQUET.planks.map((_, stain) =>
    planksOf(span, PLANK_WIDTH, PLANK_RATIO)
      .filter((_plank, index) => stainOf(index) === stain)
      .map(
        (plank) =>
          `M${plank.x + SEAM} ${plank.y + SEAM}h${plank.width - SEAM * 2}v${plank.height - SEAM * 2}h${-(plank.width - SEAM * 2)}z`,
      )
      .join(''),
  )
  return (
    <View
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: PARQUET.seam }}
      pointerEvents="none"
      aria-hidden
    >
      <Svg width={width} height={height}>
        {/* The floor is laid square, planks upright and flat, and centred on the screen. */}
        <G transform={`translate(${(width - span) / 2} ${(height - span) / 2})`}>
          {paths.map((d, stain) => (
            <Path key={stain} d={d} fill={PARQUET.planks[stain]} />
          ))}
        </G>
      </Svg>
    </View>
  )
}
