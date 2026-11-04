import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path, Polygon } from 'react-native-svg'

import { MIRROR_GLASS } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import { crackRays, shatterShards, type CrackRay, type Shard } from '@/lib/mirror-break'
import type { Position } from '@/types/game'

// What a run does to MIRROR's glass: gloss catching the light here and there, a crack where
// each missed target stood, and on the last heart the whole mirror in pieces, falling away from
// that target.
//
// In front of the run rather than behind it with the fog, since all of this is in the glass and
// everything the player sees is in the glass too. Behind the game-over title, which comes later
// in the screen's tree, and never pressable.

// Where a crack strikes when there is no target to say: a run put back from storage has lost
// its hearts already and its targets are gone. In fractions of the screen, clear of the sum row
// and the dial's middle. And how far every crack runs and how each is seeded.
const STRIKES = [
  { x: 0.76, y: 0.3 },
  { x: 0.22, y: 0.56 },
  { x: 0.6, y: 0.8 },
] as const
const CRACK_REACH = 0.44
const CRACK_SEED = 11

// A gloss: a soft slanted band of light, here and gone, at somewhere new each time. Two of them,
// so one can be coming as the other goes, with a wait of their own between each.
const GLOSS_WIDTH = 70
const GLOSS_HEIGHT = 250
const GLOSS_LEAN = '24deg'
const GLOSS_IN_MS = 600
const GLOSS_OUT_MS = 900
const GLOSS_REST_MS = 1500
const GLOSS_REST_SPREAD_MS = 3000
const GLOSS_STARTS = [800, 2700] as const

const CRACK_MS = 150
const SHADOW_WIDTH = 2.4
const LINE_WIDTH = 1.1

const SHARD_COLS = 5
const SHARD_ROWS = 7
const IMPACT = { x: 0.5, y: 0.45 }
const SHATTER_SEED = 71

// The glass goes to pieces in an instant, holds for a beat so it can be seen whole, then falls
// from the impact outwards. All of it before the game-over screen starts to come in.
const SHATTER_APPEAR_MS = 70
const SHATTER_HOLD_MS = 280
const SHATTER_SPREAD_MS = 320
const SHARD_FALL_MS = 820
// How far a piece strays sideways, and how far it turns, by the time it has gone.
const SHARD_DRIFT = 46
const SHARD_SPIN = 130
// How solid a piece is, depending on the light it catches.
const SHARD_OPACITY = 0.72
const SHARD_GLINT = 0.2

const AnimatedPath = Animated.createAnimatedComponent(Path)

// One line of a crack, running out from the point struck: the dark edge, and the bright one.
function Ray({ ray, drawn }: { ray: CrackRay; drawn: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: ray.length * (1 - drawn.value),
  }))
  return (
    <>
      <AnimatedPath
        d={ray.path}
        animatedProps={props}
        strokeDasharray={`${ray.length}`}
        fill="none"
        stroke={MIRROR_GLASS.crackShadow}
        strokeWidth={SHADOW_WIDTH}
      />
      <AnimatedPath
        d={ray.path}
        animatedProps={props}
        strokeDasharray={`${ray.length}`}
        fill="none"
        stroke={MIRROR_GLASS.crack}
        strokeWidth={LINE_WIDTH}
      />
    </>
  )
}

function Crack({ at, seed }: { at: Position; seed: number }) {
  const { width } = useViewport()
  const rays = useMemo(() => crackRays(at, CRACK_REACH * width, seed), [at, seed, width])
  const drawn = useSharedValue(0)
  useEffect(() => {
    drawn.value = withTiming(1, { duration: CRACK_MS, easing: Easing.out(Easing.quad) })
  }, [])
  return (
    <>
      {rays.map((ray) => (
        <Ray key={ray.path} ray={ray} drawn={drawn} />
      ))}
    </>
  )
}

// One gloss, coming up somewhere new each time.
function Gloss({ startsAfter }: { startsAfter: number }) {
  const { width, height } = useViewport()
  const shown = useSharedValue(0)
  const left = useSharedValue(0)
  const top = useSharedValue(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const appear = () => {
      left.value = Math.random() * width - GLOSS_WIDTH / 2
      top.value = Math.random() * height - GLOSS_HEIGHT / 2
      shown.value = withSequence(
        withTiming(1, { duration: GLOSS_IN_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: GLOSS_OUT_MS, easing: Easing.in(Easing.quad) }),
      )
      timer = setTimeout(
        appear,
        GLOSS_IN_MS + GLOSS_OUT_MS + GLOSS_REST_MS + Math.random() * GLOSS_REST_SPREAD_MS,
      )
    }
    timer = setTimeout(appear, startsAfter)
    return () => {
      clearTimeout(timer)
    }
  }, [width, height])
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    left: left.value,
    top: top.value,
  }))
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: GLOSS_WIDTH,
          height: GLOSS_HEIGHT,
          borderRadius: GLOSS_WIDTH / 2,
          overflow: 'hidden',
          transform: [{ rotate: GLOSS_LEAN }],
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[MIRROR_GLASS.shineClear, MIRROR_GLASS.shine, MIRROR_GLASS.shineClear]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  )
}

// One piece of the glass, in its own small drawing so it can turn about its own middle.
function ShardPiece({ shard, height }: { shard: Shard; height: number }) {
  const { width } = useViewport()
  const appear = useSharedValue(0)
  const fall = useSharedValue(0)
  useEffect(() => {
    appear.value = withTiming(1, { duration: SHATTER_APPEAR_MS })
    fall.value = withDelay(
      SHATTER_HOLD_MS + shard.distance * SHATTER_SPREAD_MS,
      withTiming(1, { duration: SHARD_FALL_MS, easing: Easing.in(Easing.quad) }),
    )
  }, [])

  const xs = shard.corners.map((corner) => corner.x * width)
  const ys = shard.corners.map((corner) => corner.y * height)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const boxWidth = Math.max(...xs) - left
  const boxHeight = Math.max(...ys) - top
  const points = xs.map((x, index) => `${x - left},${(ys[index] ?? top) - top}`).join(' ')

  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateX: shard.drift * SHARD_DRIFT * fall.value },
      { translateY: fall.value * height * 1.2 },
      { rotate: `${shard.spin * SHARD_SPIN * fall.value}deg` },
    ],
  }))
  return (
    <Animated.View
      style={[
        { position: 'absolute', left, top, width: boxWidth, height: boxHeight },
        style,
      ]}
    >
      <Svg width={boxWidth} height={boxHeight} style={{ overflow: 'visible' }}>
        <Polygon
          points={points}
          fill={MIRROR_GLASS.fog}
          fillOpacity={SHARD_OPACITY + shard.glint * SHARD_GLINT}
          stroke={MIRROR_GLASS.crack}
          strokeWidth={LINE_WIDTH}
        />
      </Svg>
    </Animated.View>
  )
}

function Shatter({ impact }: { impact: Position }) {
  const { height } = useViewport()
  const shards = useMemo(
    () => shatterShards(SHARD_COLS, SHARD_ROWS, impact, SHATTER_SEED),
    [impact],
  )
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
  }, [])
  return (
    <>
      {shards.map((shard, index) => (
        <ShardPiece key={index} shard={shard} height={height} />
      ))}
    </>
  )
}

export function MirrorDamage({
  livesLost,
  livesLeft,
  lostAt,
}: {
  livesLost: number
  livesLeft: number
  lostAt: readonly Position[]
}) {
  const { width, height } = useViewport()
  // Where this layer stands in the window, which is what the marks are measured in. Not the
  // window's own corner on a screen that centres the game in a wider one.
  const layer = useRef<View>(null)
  const [origin, setOrigin] = useState<Position>({ x: 0, y: 0 })
  useEffect(() => {
    layer.current?.measureInWindow((x, y) => {
      setOrigin({ x, y })
    })
  }, [width, height])

  // A crack for each heart gone: at its target's place, or a place of its own without one.
  const strikes = Array.from({ length: Math.max(0, livesLost) }, (_, index): Position => {
    const mark = lostAt[index]
    if (mark !== undefined) return { x: mark.x - origin.x, y: mark.y - origin.y }
    const strike = STRIKES[index % STRIKES.length] ?? IMPACT
    return { x: strike.x * width, y: strike.y * height }
  })
  const fatal = strikes[strikes.length - 1]
  const impact =
    fatal === undefined ? IMPACT : { x: fatal.x / width, y: fatal.y / height }

  return (
    <View
      ref={layer}
      className="absolute inset-0 overflow-hidden"
      pointerEvents="none"
      aria-hidden
    >
      {livesLeft <= 0 && livesLost > 0 ? (
        <Shatter impact={impact} />
      ) : (
        <>
          {GLOSS_STARTS.map((startsAfter) => (
            <Gloss key={startsAfter} startsAfter={startsAfter} />
          ))}
          <Svg width={width} height={height} style={{ position: 'absolute' }}>
            {strikes.map((at, index) => (
              <Crack key={index} at={at} seed={CRACK_SEED + index * CRACK_SEED} />
            ))}
          </Svg>
        </>
      )}
    </View>
  )
}
