import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { WaxBlob } from '@/components/game/wax-blob'
import { LAVA } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import type { OpeningTake } from '@/modes'

// DRIFT's **opening**: a lava lamp warming up.
//
// The screen is the lamp's pink glass from the first frame, and the scene is what happens in it. A
// pool of light comes up at the foot of the targets' area and a puddle of wax swells in it; then a
// lump breaks off the puddle and climbs, from purple to pink as it goes — the scale every target is
// coloured on, shown once — and thins away as the run's first target arrives. What the scene leaves
// behind (`LavaRemains`) is three faint lumps, slow, behind the dial for the whole run.
//
// The `short` take, for a run dealt again, is only the glow and a quick lump.

const BEATS = {
  full: { wait: 250, warm: 1300, rise: 1500, done: 3000, out: 400 },
  short: { wait: 0, warm: 300, rise: 420, done: 760, out: 160 },
} as const satisfies Record<
  OpeningTake,
  { wait: number; warm: number; rise: number; done: number; out: number }
>

// Where the lamp stands and how far the lump climbs, as shares of the screen's height: the puddle
// on the lower edge of the targets' area, the lump as far up it as the first target may be dealt.
const FOOT_AT = 0.52
const TOP_AT = 0.2
// How wide the pool of light is, as a share of the screen's width, and how big the puddle and the
// climbing lump are drawn.
const POOL = 0.75
const PUDDLE = 0.62
const LUMP = 150

// The light at the lamp's foot, coming up.
function Pool({ warm, out }: { warm: SharedValue<number>; out: SharedValue<number> }) {
  const { width, height } = useViewport()
  const radius = width * POOL
  const style = useAnimatedStyle(() => ({
    opacity: warm.value * (1 - out.value * 0.4),
    transform: [{ scale: 0.4 + 0.6 * warm.value }],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={[
        {
          position: 'absolute',
          left: width / 2 - radius,
          top: height * FOOT_AT - radius,
          width: radius * 2,
        },
        style,
      ]}
    >
      <Svg width={radius * 2} height={radius * 2}>
        <Defs>
          <RadialGradient id="lamp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={LAVA.glow} stopOpacity={0.7} />
            <Stop offset="1" stopColor={LAVA.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill="url(#lamp)" />
      </Svg>
    </Animated.View>
  )
}

// The puddle of wax the lump comes off, swelling as the lamp warms and sinking back as the lump goes.
function Puddle({ warm, out }: { warm: SharedValue<number>; out: SharedValue<number> }) {
  const { width, height } = useViewport()
  const side = width * PUDDLE
  const style = useAnimatedStyle(() => ({
    opacity: 1 - out.value,
    transform: [{ scaleX: 0.5 + 0.5 * warm.value }, { scaleY: 0.2 + 0.28 * warm.value }],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={[
        {
          position: 'absolute',
          left: (width - side) / 2,
          top: height * FOOT_AT - side / 2,
        },
        style,
      ]}
    >
      <WaxBlob size={side} phase={0.4} heading={0} heat={0} step={0} wakeIn={0} />
    </Animated.View>
  )
}

// The lump that breaks off and climbs, purple at the foot and pink where it goes out.
function Lump({
  rise,
  out,
  heat,
  warmMs,
}: {
  rise: SharedValue<number>
  out: SharedValue<number>
  heat: number
  warmMs: number
}) {
  const { width, height } = useViewport()
  const style = useAnimatedStyle(() => ({
    opacity: rise.value > 0 ? 1 - out.value : 0,
    transform: [{ translateY: -(FOOT_AT - TOP_AT) * height * rise.value }],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={[
        {
          position: 'absolute',
          left: (width - LUMP) / 2,
          top: height * FOOT_AT - LUMP / 2,
        },
        style,
      ]}
    >
      <WaxBlob
        size={LUMP}
        phase={2.1}
        heading={1}
        heat={heat}
        step={0}
        wakeIn={0}
        warmMs={warmMs}
      />
    </Animated.View>
  )
}

export function LavaLamp({ take, sweep, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]
  const warm = useSharedValue(0)
  const rise = useSharedValue(0)
  const out = useSharedValue(0)
  // The lump is purple while it sits in the puddle and turns pink as it climbs.
  const [heat, setHeat] = useState(0)

  useEffect(() => {
    sweep.value = 0
    warm.value = withDelay(
      beats.wait,
      withTiming(1, { duration: beats.warm, easing: Easing.inOut(Easing.quad) }),
    )
    rise.value = withDelay(
      beats.wait + beats.warm,
      withTiming(1, { duration: beats.rise, easing: Easing.in(Easing.quad) }),
    )
    sweep.value = withDelay(beats.wait, withTiming(1, { duration: beats.warm }))
    out.value = withDelay(beats.done - beats.out, withTiming(1, { duration: beats.out }))
    const hot = setTimeout(() => {
      setHeat(1)
    }, beats.wait + beats.warm)
    // The scheme is the lamp's from the first frame; there is no screen to turn over.
    onSwitch()
    const done = setTimeout(onDone, beats.done)
    return () => {
      clearTimeout(hot)
      clearTimeout(done)
      // A skip lands here part-way. Whole, so the run starts on a lit lamp.
      sweep.value = 1
    }
  }, [])

  return (
    <View className="absolute inset-0" pointerEvents="none" aria-hidden>
      <Pool warm={warm} out={out} />
      <Puddle warm={warm} out={out} />
      <Lump rise={rise} out={out} heat={heat} warmMs={beats.rise} />
    </View>
  )
}

// One lump of what the scene leaves: faint, big, and creeping up and down on a rhythm of its own.
function AmbientWax({
  left,
  top,
  side,
  phase,
  heat,
  travel,
  period,
}: {
  // Shares of the screen's width and height its centre stands at.
  left: number
  top: number
  side: number
  phase: number
  heat: number
  // How far it creeps, in px, and how long a creep up and back takes, in ms.
  travel: number
  period: number
}) {
  const { width, height } = useViewport()
  const creep = useSharedValue(-1)
  useEffect(() => {
    creep.value = withRepeat(
      withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: creep.value * travel }],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={[
        {
          position: 'absolute',
          left: width * left - side / 2,
          top: height * top - side / 2,
          opacity: 0.28,
        },
        style,
      ]}
    >
      <WaxBlob size={side} phase={phase} heading={0} heat={heat} step={0} wakeIn={0} />
    </Animated.View>
  )
}

// Everything the scene leaves behind the run: three lumps from the cool end of the scale to the hot,
// slow enough that the dial in front of them is what the eye keeps.
export function LavaRemains() {
  const { width } = useViewport()
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" aria-hidden>
      <AmbientWax
        left={0.18}
        top={0.62}
        side={width * 0.9}
        phase={0.3}
        heat={0.05}
        travel={46}
        period={11000}
      />
      <AmbientWax
        left={0.82}
        top={0.4}
        side={width * 0.8}
        phase={2.2}
        heat={0.5}
        travel={-38}
        period={13000}
      />
      <AmbientWax
        left={0.5}
        top={0.85}
        side={width}
        phase={4.1}
        heat={0.95}
        travel={30}
        period={9500}
      />
    </View>
  )
}
