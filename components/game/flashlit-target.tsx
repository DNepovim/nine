import { useEffect, useState, type ComponentProps } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { fontSizeForDigits } from '@/components/game/pie-countdown'
import type { TargetCard } from '@/components/game/target-card'
import { LIGHTS_OUT } from '@/constants/colors'
import { CARD_ENTER_MS, PIE_SIZE, TARGET_EXIT_MS } from '@/constants/game'
import { useDriftedValue } from '@/hooks/use-drifted-value'
import { useTargetClock } from '@/hooks/use-target-clock'
import { beamColour, beamStep } from '@/lib/beam-colour'

// A target as a number written on the wall of a dark room, in a flashlight's beam: the
// `flashlit` **target form**, BLACKOUT's.
//
// There is no disc and no ring. The clock is the battery: the light turns from warm white
// through orange to deep red and the pool closes in on the number as the time runs down, and
// it stutters at the very end.
// The number is paint, so it can only be seen where the light falls. A hit flares the beam and
// it goes; a lost target's flickers out.
//
// Keeps the contract a disc keeps, so the machine and the screen never hear about it.

// How wide the pool is against the target, and how far it has closed at the last of the
// clock: still far enough out to keep a three-figure number inside its bright middle.
const POOL_RATIO = 2
const CLOSED_SCALE = 0.65

// The last stretch of the clock, in which the light stutters.
const FAILING_BELOW = 0.2
const STUTTER_DEPTH = 0.15
const STUTTER_RATE = 260

const HIT_FLARE = 0.3

// A beam's hot middle, then a quick fall to the spill at its edge.
const BEAM_STOPS = [
  { offset: '0%', opacity: 0.95 },
  { offset: '60%', opacity: 0.85 },
  { offset: '80%', opacity: 0.5 },
  { offset: '92%', opacity: 0.14 },
  { offset: '100%', opacity: 0 },
] as const

// Written by hand, so no two sit quite level. Keyed on the target's place in the run, so a
// number keeps its slant from one render to the next.
const SLANTS = [-4, 2, -2, 3, -3, 1] as const

// The beam going out when a target is lost: the battery catching twice, then gone.
const FAIL_FLICKER = [
  { to: 0.25, duration: 80 },
  { to: 0.8, duration: 60 },
  { to: 0.15, duration: 80 },
  { to: 0.55, duration: 80 },
  { to: 0, duration: 200 },
] as const

// `id` is the target's own: every beam on the board is a different colour, and an SVG
// gradient is looked up by id across the whole document.
function Beam({ size, id, colour }: { size: number; id: string; colour: string }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          {BEAM_STOPS.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={colour}
              stopOpacity={stop.opacity}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  )
}

export function FlashlitTarget({
  target,
  duration,
  size = PIE_SIZE,
  dying = false,
  frozen = false,
  clocked = true,
  driftStep = null,
  onExpire,
  onExitComplete,
}: ComponentProps<typeof TargetCard>) {
  const leaving = target.exit !== null || dying
  const reading = useDriftedValue(target, driftStep, !leaving && !frozen)
  const shown = target.takenAt ?? reading
  const progress = useTargetClock({
    startProgress: target.startProgress,
    duration,
    running: !leaving && !frozen && clocked,
    onExpire,
  })
  // How far the flashlight is on, separate from how much battery the clock has left it.
  const power = useSharedValue(0)
  const flare = useSharedValue(0)
  // The beam is redrawn a step at a time as the battery goes; see `beamColour`.
  const [step, setStep] = useState(() => beamStep(target.startProgress))
  useAnimatedReaction(
    () => beamStep(progress.value),
    (now, was) => {
      if (was !== null && now !== was) scheduleOnRN(setStep, now)
    },
  )

  useEffect(() => {
    power.value = withTiming(1, { duration: CARD_ENTER_MS })
  }, [])

  useEffect(() => {
    if (dying) {
      power.value = withTiming(0, { duration: TARGET_EXIT_MS })
      return
    }
    const finish = (finished?: boolean) => {
      'worklet'
      if (finished) scheduleOnRN(onExitComplete)
    }
    if (target.exit === 'hit') {
      flare.value = withTiming(1, {
        duration: TARGET_EXIT_MS,
        easing: Easing.out(Easing.quad),
      })
      power.value = withTiming(
        0,
        { duration: TARGET_EXIT_MS, easing: Easing.in(Easing.quad) },
        finish,
      )
    }
    if (target.exit === 'failed') {
      const flickers = FAIL_FLICKER.map(({ to, duration: ms }, step) =>
        withTiming(
          to,
          { duration: ms },
          step === FAIL_FLICKER.length - 1 ? finish : undefined,
        ),
      )
      power.value = withSequence(...flickers)
    }
  }, [target.exit, dying])

  const poolStyle = useAnimatedStyle(() => {
    const left = progress.value
    const stutter =
      left < FAILING_BELOW
        ? 1 - STUTTER_DEPTH * (0.5 + 0.5 * Math.sin(left * STUTTER_RATE))
        : 1
    return {
      opacity: power.value * stutter,
      transform: [
        {
          scale:
            (CLOSED_SCALE + (1 - CLOSED_SCALE) * left) * (1 + HIT_FLARE * flare.value),
        },
      ],
    }
  })
  const paintStyle = useAnimatedStyle(() => ({ opacity: power.value }))

  const pool = size * POOL_RATIO
  const spill = (pool - size) / 2
  const slant = SLANTS[target.seq % SLANTS.length] ?? 0
  return (
    <View
      style={{
        position: 'absolute',
        left: target.position.x,
        top: target.position.y,
        width: size,
        height: size,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: -spill, top: -spill, width: pool, height: pool },
          poolStyle,
        ]}
      >
        <Beam size={pool} id={`beam-${target.id}`} colour={beamColour(step)} />
      </Animated.View>
      <View className="absolute inset-0 items-center justify-center">
        <Animated.Text
          selectable={false}
          numberOfLines={1}
          className="font-mono font-extrabold"
          style={[
            {
              color: LIGHTS_OUT.paint,
              fontSize: fontSizeForDigits(shown, size / PIE_SIZE),
              includeFontPadding: false,
              transform: [{ rotate: `${slant}deg` }],
            },
            paintStyle,
          ]}
        >
          {shown}
        </Animated.Text>
      </View>
    </View>
  )
}
