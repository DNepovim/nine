import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, type ComponentProps } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Polyline, RadialGradient, Stop } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { TargetCard } from '@/components/game/target-card'
import { STORM, STORM_ORB } from '@/constants/colors'
import { PIE_SIZE, TARGET_EXIT_MS } from '@/constants/game'
import { boltPath, boltPoints } from '@/lib/storm'
import { glimpseLeft } from '@/lib/target-clock'

// A target as a disc a bolt of lightning hits: the `struck` **target form**, GLIMPSE's.
//
// The disc is the ordinary one, and the number on it is the run's **glimpse** as it always
// is. What this form adds is the reason the number goes: when the glimpse is over, a bolt
// comes down from the top of the board onto the disc and the flash it makes swallows the
// number as the card fades it out. Drawing only — the glimpse is `PieCountdown`'s, counted
// by the same figure here, so the bolt and the blanking land together.
//
// Keeps the contract a disc keeps, so the machine and the screen never hear about it.

const BOLT_WIDTH = 120
// How far the glow around the foot of the bolt spreads, against the disc.
const GLOW_RATIO = 3.2
// A disc that is hit burns out: charred black with an ember rim, there at once and gone with the card.
const CHAR = '#1A1008'
const EMBER = '#FF8A3D'
const STRIKE_STEPS = [
  { to: 1, ms: 40 },
  { to: 0.25, ms: 70 },
  { to: 1, ms: 50 },
  { to: 0, ms: 280 },
] as const

export function StruckTarget(props: ComponentProps<typeof TargetCard>) {
  const { target, glimpse = null, size = PIE_SIZE, frozen = false, dying = false } = props
  const leaving = target.exit !== null || dying
  // Whatever of the glimpse is left to wait for, counted the way the card counts it.
  const wait = glimpseLeft(glimpse, target.startProgress, target.duration)
  const strike = useSharedValue(0)
  const burn = useSharedValue(0)
  const burnt = target.exit === 'hit'

  // A taken disc is scorched as it goes: blackened in a flicker, then faded out with the card.
  useEffect(() => {
    if (!burnt) return
    burn.value = withSequence(
      withTiming(0.95, { duration: 60 }),
      withTiming(0.6, { duration: 60 }),
      withTiming(0.9, { duration: 60 }),
      withTiming(0, { duration: TARGET_EXIT_MS }),
    )
  }, [burnt])
  const burnStyle = useAnimatedStyle(() => ({ opacity: burn.value }))
  const held = useSharedValue(wait ?? 0)
  const active = !leaving && !frozen

  // The bolt falls when the glimpse has run out, held where it stands while the run is
  // paused and cancelled for a card that leaves first, so no bolt hits one already gone.
  useEffect(() => {
    if (wait === null || wait === 0) return
    if (!active) {
      cancelAnimation(held)
      return
    }
    if (held.value <= 0) return
    const land = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    held.value = withTiming(
      0,
      { duration: held.value, easing: Easing.linear },
      (finished) => {
        if (!finished) return
        scheduleOnRN(land)
        strike.value = withSequence(
          ...STRIKE_STEPS.map(({ to, ms }) => withTiming(to, { duration: ms })),
        )
      },
    )
  }, [active])

  // Everything from the top of the board down to the middle of the disc.
  const reach = target.position.y + size / 2
  const points = useMemo(
    () => boltPath(boltPoints(target.seq + 1, BOLT_WIDTH, reach)),
    [target.seq, reach],
  )
  const boltStyle = useAnimatedStyle(() => ({ opacity: strike.value }))
  const glow = size * GLOW_RATIO
  const id = `strike-${target.id}`

  return (
    <>
      <TargetCard orb={STORM_ORB} {...props} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: target.position.x,
          top: target.position.y,
          width: size,
          height: size,
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: CHAR,
              borderWidth: 3,
              borderColor: EMBER,
            },
            burnStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: (size - glow) / 2,
              top: (size - glow) / 2,
              width: glow,
              height: glow,
            },
            boltStyle,
          ]}
        >
          <Svg width={glow} height={glow}>
            <Defs>
              <RadialGradient id={id} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={STORM.glow} stopOpacity={0.95} />
                <Stop offset="55%" stopColor={STORM.glow} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={STORM.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${id})`} />
          </Svg>
        </Animated.View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: (size - BOLT_WIDTH) / 2,
              top: -reach + size / 2,
            },
            boltStyle,
          ]}
        >
          <Svg width={BOLT_WIDTH} height={reach}>
            <Polyline
              points={points}
              fill="none"
              stroke={STORM.boltEdge}
              strokeWidth={8}
              strokeOpacity={0.6}
              strokeLinejoin="round"
            />
            <Polyline
              points={points}
              fill="none"
              stroke={STORM.bolt}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </View>
    </>
  )
}
