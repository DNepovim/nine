import { Text } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { LANE_SPREAD } from '@/constants/siege'
import { mapLabel } from '@/constants/theme'
import type { Warrior } from '@/machines/siege'

// One warrior crossing the ground between the gate and the hero.
//
// Nothing about this is React state. The hook knows only when a warrior left and how long
// it takes; where it *is* comes off the canvas clock on the UI thread, which is what keeps
// a fight with three of them on the ground from re-rendering the whole map sixty times a
// second. The only three things React hears about are the spawn, the kill and the arrival.

// A man, in map points — about 36 on the screen at the siege zoom, which is half again
// under the hero he is walking at. Three digits is as long as a sum on this dial gets, and
// at this size they clear the inside of the disc with a couple of points to spare.
const SIZE = 15
const FONT = 6.5
const STROKE = 1.2

// How far off the straight line a lane carries a man at the middle of his walk.
//
// `lane` is in radians off straight and runs over `LANE_SPREAD`, so this is the one number
// that turns that into points: at the two ends of the spread two men are exactly one man
// apart at the moment they pass each other, which is the closest two of them may come. In
// points rather than as a fraction of the walk, because the walk is short — the hero stands
// at the gate — and a fraction of it would have put two men inside each other on a small
// screen.
const LANE = SIZE / LANE_SPREAD

// How long a man takes to be on the ground. Not a fade — he grows out of the gate, which is
// the same beat a tower takes to settle after a hit.
const OUT_MS = 220

export function SiegeWarrior({
  warrior,
  clock,
  epoch,
  fromX,
  fromY,
  toX,
  toY,
  turn,
  ink,
  line,
  face,
}: {
  warrior: Warrior
  // The canvas clock, in ms since the first frame.
  clock: SharedValue<number>
  // What that clock reads as wall-clock zero, so `spawnedAt` and `clock` can be compared.
  epoch: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  turn: SharedValue<number>
  ink: string
  line: string
  face: string
}) {
  const dx = toX - fromX
  const dy = toY - fromY
  const span = Math.hypot(dx, dy) || 1
  // The line the lanes fan across: at right angles to the walk, so a man comes down his own
  // line whichever way the gate happens to face.
  const outX = -dy / span
  const outY = dx / span
  const bow = warrior.lane * LANE

  const walk = useAnimatedStyle(() => {
    const elapsed = epoch + clock.value - warrior.spawnedAt
    const t = Math.min(1, Math.max(0, elapsed / warrior.walkMs))
    // Nought at both ends and widest in the middle: they leave the one gate and arrive at
    // the one hero, and what differs is the ground they take to get there.
    const off = Math.sin(t * Math.PI) * bow
    return {
      transform: [
        { translateX: fromX + dx * t + outX * off },
        { translateY: fromY + dy * t + outY * off },
        { scale: Math.min(1, Math.max(0, elapsed / OUT_MS)) },
      ],
    }
  })

  const upright = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))

  return (
    // The walk is on the outer view and the turn on the inner one, and it has to be that
    // way round: a transform list composes, so a rotation sitting beside the translation
    // would carry the man off down a line of its own every time the sheet came round.
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={[{ left: -SIZE / 2, top: -SIZE / 2, width: SIZE, height: SIZE }, walk]}
    >
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={SIZE / 2 - STROKE / 2}
          fill={face}
          stroke={line}
          strokeWidth={STROKE}
        />
      </Svg>
      <Animated.View style={upright}>
        <Text
          selectable={false}
          className="font-semibold"
          style={{ fontFamily: mapLabel, color: ink, fontSize: FONT }}
        >
          {warrior.value}
        </Text>
      </Animated.View>
    </Animated.View>
  )
}
