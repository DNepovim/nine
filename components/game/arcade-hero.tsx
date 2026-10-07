import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { G } from 'react-native-svg'

import { FlameCoat } from '@/components/game/flame-coat'
import { HeroSmoke } from '@/components/game/hero-smoke'
import { HERO_SIZE, WALK_MS } from '@/constants/arcade'
import { splinePoint, type Spline } from '@/lib/arcade-layout'
import { tiltedAt, type Sheet } from '@/lib/arcade-tilt'
import { createTrail, driftTrail, LAY_MS, layTrail } from '@/lib/smoke'

// The hero: a torch, looked down on.
//
// Abstract on purpose — the app has no characters and no illustration in it, so a creature
// here would be the first. A light is also the only mark that can be the brightest thing on
// a sheet of grey ink without needing a second colour, and the only one that can move while
// standing still: the flame flickers at a crossroad, which is what says the run is waiting
// for an answer rather than stopped.
//
// Drawn in plan, because the map is. A flame seen from above has no up and no lean; what it
// has is a direction it is being drawn out in and a trail of smoke it has left behind. Both
// come from one number — how fast the hero is going, measured off its own position frame by
// frame — and neither needs to know which way the sheet has been turned. That is the gain
// over the flame this replaced, which was drawn in profile and had to have the sheet's turn
// taken back out of it so that fire would keep pointing up the screen.
//
// Its position is read off the same spline the way is drawn from, at the same moment and on
// the same thread, so it rides the line rather than crossing it as the way breathes. And then
// projected onto the tilted sheet, like every other mark — the way is drawn short when it runs
// up the map, and a flame on the flat line would walk clean off it.
//
// The whole box is carried and scaled rather than the flame alone, so the smoke goes with it:
// a plume is a trail of the ground the hero covered, and the two have to be as far off as
// each other. What it gives up is that the far end of a plume is as deep as its near end,
// which is a pitch of sheet at most and already fading as it is drawn.
//
// Its own pace is measured on the flat position, not the drawn one. The flame leans and the
// smoke lays off how fast the hero is going over the ground, and a hero that appeared to slow
// down simply for being further off would be the tilt telling a lie about the run.

// How much the whole flame swells while it waits. Small — the flicker is doing the work.
const PULSE = 1.06
const PULSE_MS = 820

// The coats the flare is stacked from, outermost first. `radius` and `reach` are multiples of
// the flame's own size: how wide the coat is standing still, and how far it is drawn out
// behind at a walk. The outer coats reach further and ruffle on a coarser grain; the wick
// barely moves and barely flickers.
const COATS = [
  {
    key: 'halo',
    tone: 'amber',
    radius: 2.1,
    reach: 2.2,
    grain: 0.5,
    amp: 0.8,
    opacity: 0.12,
  },
  {
    key: 'wisp',
    tone: 'ember',
    radius: 1.05,
    reach: 2,
    grain: 1.6,
    amp: 1.35,
    opacity: 0.3,
  },
  {
    key: 'body',
    tone: 'amber',
    radius: 0.78,
    reach: 1.7,
    grain: 1,
    amp: 1,
    opacity: 0.92,
  },
  {
    key: 'core',
    tone: 'core',
    radius: 0.3,
    reach: 0.9,
    grain: 2.6,
    amp: 0.7,
    opacity: 1,
  },
] as const satisfies readonly {
  key: string
  tone: 'amber' | 'ember' | 'core'
  radius: number
  reach: number
  grain: number
  amp: number
  opacity: number
}[]

// How far the smoke carries, as a share of a pitch — and so, at twice that, the box the whole
// hero is drawn in. A little over one way's length: long enough that a rocket leaves a plume
// worth seeing, short enough that the map is never two drawings at once.
const REACH = 1.1

// The most of a walk's pace that counts as "going", so a strike reads as faster than a walk
// rather than as the same flame.
const TOP_SPEED = 1.5

// How quickly the flame answers a change of pace. Over about a tenth of a second, which is
// slow enough that a frame dropped here or there never shows as a flinch.
const EASE_MS = 90

// Below this share of a walk there is no heading worth reading — the flame holds the last one
// it had rather than spinning on the noise in its own position.
const STIRRING = 0.02

// Where the flame is at `t`, which runs 0 → 1 along one way and 1 → 2 on through a second.
function heroAt(
  t: number,
  spline: Spline | null,
  originX: number,
  originY: number,
  through: Spline | null,
  throughX: number,
  throughY: number,
  clockMs: number,
): { x: number; y: number } {
  'worklet'
  if (spline === null) return { x: originX, y: originY }
  if (through !== null && t > 1) {
    const at = splinePoint(through, Math.min(1, t - 1), clockMs)
    return { x: throughX + at.x, y: throughY + at.y }
  }
  const at = splinePoint(spline, Math.max(0, Math.min(1, t)), clockMs)
  return { x: originX + at.x, y: originY + at.y }
}

export function ArcadeHero({
  originX,
  originY,
  spline,
  through,
  throughX,
  throughY,
  progress,
  clock,
  sheet,
  pitch,
  standing,
  rocketing,
  amber,
  ember,
  core,
  smoke,
}: {
  // The crossroad the first spline is measured from — the one the flame is leaving on a
  // walk, and the one behind it on a retreat.
  originX: number
  originY: number
  spline: Spline | null
  // On a strike, the way out of the crossroad being passed through, and where it sits.
  through: Spline | null
  throughX: number
  throughY: number
  // How far along the movement it has got: 0 → 1 for a walk, 1 → 0 for a retreat and
  // 0 → 2 for a strike, so one value covers them all.
  progress: SharedValue<number>
  clock: SharedValue<number>
  // The camera, which is what says where on the drawn sheet the point it has reached lands.
  sheet: SharedValue<Sheet>
  // How far apart two crossroads stand. The flame measures its own pace against it — one
  // pitch in one walk is what "going" means — and the smoke's reach is a share of it.
  pitch: number
  standing: boolean
  rocketing: boolean
  amber: string
  ember: string
  core: string
  smoke: string
}) {
  const pulse = useSharedValue(1)
  const blaze = useSharedValue(0)

  // Where the hero is, which way it is being drawn out, and how fast it is going. Written
  // once a frame and read by every coat and by the smoke, so the whole hero agrees with
  // itself without working any of it out twice.
  const atX = useSharedValue(originX)
  const atY = useSharedValue(originY)
  const tail = useSharedValue(0)
  const speed = useSharedValue(0)
  const lastX = useSharedValue(originX)
  const lastY = useSharedValue(originY)
  const since = useSharedValue(0)
  const trail = useSharedValue(createTrail())

  useEffect(() => {
    if (!standing) {
      pulse.value = withTiming(1, { duration: 200 })
      return
    }
    pulse.value = withRepeat(
      withTiming(PULSE, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [standing])

  // Under power it burns harder. Animated rather than switched, because nothing in this app
  // changes between two frames.
  useEffect(() => {
    blaze.value = withTiming(rocketing ? 1 : 0, { duration: 180 })
  }, [rocketing])

  // The hero's own pace, read off the ground it covers rather than off the beat it is in.
  // One rule for a walk, a retreat, a fall and a strike, and the only one that stays true
  // through the easings at both ends of each of them.
  useFrameCallback((frame) => {
    const dt = frame.timeSincePreviousFrame ?? 0
    if (dt <= 0 || pitch <= 0) return
    const now = clock.value
    const at = heroAt(
      progress.value,
      spline,
      originX,
      originY,
      through,
      throughX,
      throughY,
      now,
    )
    atX.value = at.x
    atY.value = at.y

    const went = Math.hypot(at.x - lastX.value, at.y - lastY.value)
    const heading = Math.atan2(lastY.value - at.y, lastX.value - at.x)
    lastX.value = at.x
    lastY.value = at.y

    // A walk covers one pitch in one walk's time, so that is one. Eased rather than taken
    // raw: a flame that answered every frame would flinch at every easing.
    const pace = Math.min(TOP_SPEED, went / ((pitch / WALK_MS) * dt))
    speed.value += (pace - speed.value) * Math.min(1, dt / EASE_MS)
    if (speed.value > STIRRING) tail.value = heading

    since.value += dt
    while (since.value >= LAY_MS) {
      since.value -= LAY_MS
      layTrail(trail.value, at.x, at.y, speed.value, now, HERO_SIZE)
    }
    driftTrail(trail.value, dt, now, HERO_SIZE)
  })

  const reach = pitch * REACH
  const box = reach * 2

  const style = useAnimatedStyle(() => {
    const lie = tiltedAt(sheet.value, atX.value, atY.value)
    return {
      transform: [
        { translateX: lie.x - box / 2 },
        { translateY: lie.y - box / 2 },
        { scale: lie.scale },
      ],
    }
  })

  if (pitch <= 0) return null

  const tones = { amber, ember, core }

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: box, height: box }, style]}
    >
      <Svg width={box} height={box}>
        {/* The flame stands at the centre of its box, so the point the spline hands back is
            the fire itself and everything else is measured from it. */}
        <G transform={`translate(${box / 2}, ${box / 2})`}>
          <HeroSmoke
            trail={trail}
            clock={clock}
            atX={atX}
            atY={atY}
            reach={reach}
            ink={smoke}
          />
          {COATS.map((coat) => (
            <FlameCoat
              key={coat.key}
              size={HERO_SIZE}
              radius={coat.radius}
              reach={coat.reach}
              grain={coat.grain}
              amp={coat.amp}
              fill={tones[coat.tone]}
              opacity={coat.opacity}
              clock={clock}
              pulse={pulse}
              blaze={blaze}
              tail={tail}
              speed={speed}
            />
          ))}
        </G>
      </Svg>
    </Animated.View>
  )
}
