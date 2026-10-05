import { Text } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { mapLabel } from '@/constants/theme'
import type { Tower } from '@/machines/siege'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// A tower on the wall of a besieged village, and the number it answers to.
//
// Damage is height, not a gauge: a tower knocked halfway down says what a bar under it
// would say, and says it in the map's own language. At nought it is a stump of rubble that
// still carries the number it used to answer to — dialling that number does nothing, which
// is what the flattened silhouette is there to tell you. The crenellations come down with
// it, so rubble is a flat stub rather than a short tower.
//
// Two components rather than one, and that is the whole reason this file is shaped the way
// it is. The wall is drawn in elevation on a sheet that is a plan, so a tower at the near
// side of the ring stands in front of the far side of it — which is right, and which is
// what the face colour is for. But a number that has been covered is a number that cannot
// be dialled, so the numbers are a layer of their own above every wall, the way lettering
// goes on over the drawing on any map. `SiegeField` draws all the walls, then all the
// numbers.

// The block, in map points — which the siege camera is two and a half times into, so a
// tower is drawn at about 31 by 72 on the screen. Measured against town-mark.tsx rather
// than guessed: `WIDTH` is a little under two thirds of the town's own wall radius (20),
// which is what leaves six of them room to stand round a ring of that radius.
const WIDTH = 13
const FULL = 30
// What is left when the last hit lands. Enough that rubble still reads as *something a
// wall left behind* rather than as a tower nobody finished — and a quarter of the standing
// height, which is the difference the silhouette has to carry.
const STUMP = 14

// The crenellations: three blocks of three with two gaps of two, which is exactly the
// thirteen points of the top. Square-ish blocks, like town-mark's — its merlons are about
// 2.2 across and stand 2.6 proud, and these keep that proportion at this size.
const MERLON = 3
const BLOCK = 3
const GAP = 2
const MERLONS = 3

// Town-mark's *plain* line weight rather than its walled one, and deliberately. The walled
// build is 2.2 on a wall whose merlons are 2.2 across; a stroke that wide on blocks this
// size would fuse the crenellations into a ring. The camera supplies the heavier build for
// free — 1.2 at the siege zoom lands at just under three points on the screen, which is
// the weight a fortified town is drawn in.
const STROKE = 1.2

// Room for the stroke, which SVG centres on the path and would otherwise clip.
const PAD = 1

const BOX_W = WIDTH + PAD * 2
const BOX_H = FULL + MERLON + PAD * 2
// The foot of the tower inside that box, which is the point it stands on.
const FOOT = BOX_H - PAD
const LEFT = PAD
const RIGHT = PAD + WIDTH

// The disc the number sits in: the same round tower town-mark puts at the quarters of its
// wall, with the block rising out of it. Wide enough for three digits, which is as long as
// a sum on this dial gets.
export const TOWER_DISC = 8.5
const FONT = 7.5

// How long a tower takes to settle after a hit. Short — the hit is the event, and the
// height is the receipt.
const CHIP_MS = 220

// Marked, because `towerPath` is a worklet and calls this eleven times a frame. An
// unmarked helper is unpacked into a stub that throws the moment the UI thread reaches it —
// and nothing in the static checks can see that, because to eslint and to tsc it is an
// ordinary function being called by an ordinary one.
const n = (v: number): string => {
  'worklet'
  return (Math.round(v * 10) / 10).toString()
}

// The tower at whatever height it has been knocked to, as one path: up the left side,
// across the crenellated top and down the right. One path rather than a rect with a cap on
// it, so the wall and its merlons can never come apart by half a point at the join.
//
// `rise` is one at full height and nought at rubble, and it takes the merlons down with the
// wall — so the crenellations are knocked off over the same beat the tower loses.
const towerPath = (rise: number): string => {
  'worklet'
  const height = STUMP + (FULL - STUMP) * rise
  const proud = MERLON * rise
  const top = FOOT - height
  let d = `M${LEFT} ${n(FOOT)}`
  for (let i = 0; i < MERLONS; i++) {
    const at = LEFT + i * (BLOCK + GAP)
    d += ` L${n(at)} ${n(top - proud)} L${n(at + BLOCK)} ${n(top - proud)} L${n(at + BLOCK)} ${n(top)}`
    if (i < MERLONS - 1) d += ` L${n(at + BLOCK + GAP)} ${n(top)}`
  }
  return `${d} L${RIGHT} ${n(FOOT)} Z`
}

export function SiegeTower({
  tower,
  x,
  y,
  turn,
  line,
  face,
}: {
  tower: Tower
  x: number
  y: number
  // The sheet's own turn, taken back out. A wall is drawn standing up, so it is turned
  // back for the same reason town-mark is on a bud: a tower lying on its side at the foot
  // of a ring is a tower nobody drew.
  turn: SharedValue<number>
  line: string
  // The ground's own colour, which is what every mark on this map knocks out with — and
  // here it is also what lets the near side of the wall stand in front of the far side.
  face: string
}) {
  const standing = tower.hits > 0 ? tower.left / tower.hits : 0
  const rise = useDerivedValue(() => withTiming(standing, { duration: CHIP_MS }))
  const wall = useAnimatedProps(() => ({ d: towerPath(rise.value) }))
  const upright = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))

  return (
    // A zero-size anchor on the point the tower stands on, so the turn comes back out
    // about the tower's own foot rather than about the middle of some box.
    <Animated.View
      pointerEvents="none"
      className="absolute"
      style={[{ left: x, top: y, width: 0, height: 0 }, upright]}
    >
      <Svg
        width={BOX_W}
        height={BOX_H}
        style={{ position: 'absolute', left: -BOX_W / 2, top: -FOOT }}
      >
        <AnimatedPath
          animatedProps={wall}
          fill={face}
          stroke={line}
          strokeWidth={STROKE}
          strokeLinejoin="miter"
        />
      </Svg>
    </Animated.View>
  )
}

// The number a tower answers to, in the disc at its foot. Drawn after every wall on the
// ring — see the note at the top of this file.
export function TowerNumber({
  tower,
  x,
  y,
  turn,
  ink,
  line,
  face,
}: {
  tower: Tower
  x: number
  y: number
  // A number is read, not drawn.
  turn: SharedValue<number>
  ink: string
  line: string
  face: string
}) {
  const upright = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={[
        {
          left: x - TOWER_DISC,
          top: y - TOWER_DISC,
          width: TOWER_DISC * 2,
          height: TOWER_DISC * 2,
        },
        upright,
      ]}
    >
      <Svg
        width={TOWER_DISC * 2}
        height={TOWER_DISC * 2}
        style={{ position: 'absolute' }}
      >
        <Circle
          cx={TOWER_DISC}
          cy={TOWER_DISC}
          r={TOWER_DISC - STROKE / 2}
          fill={face}
          stroke={line}
          strokeWidth={STROKE}
        />
      </Svg>
      <Text
        selectable={false}
        className="font-semibold"
        style={{ fontFamily: mapLabel, color: ink, fontSize: FONT }}
      >
        {tower.value}
      </Text>
    </Animated.View>
  )
}
