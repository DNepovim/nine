import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { STONE_MS } from '@/constants/siege'
import { mapLabel } from '@/constants/theme'
import {
  TOWER_REACH,
  TOWER_WIDTH,
  towerBody,
  towerDetail,
  towerHand,
} from '@/lib/siege-marks'
import type { Tower } from '@/machines/siege'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// A tower on the wall of a besieged village, and the number it answers to.
//
// Damage is height, not a gauge: a tower knocked halfway down says what a bar under it
// would say, and says it in the map's own language. At nought it is a stump of rubble that
// still carries the number it died under — dialling that number does nothing, which is what
// the flattened silhouette is there to tell you.
//
// The shape is drawn by the hand in lib/siege-marks.ts, which is also the hand every
// mountain on the sheet is drawn by. Nothing here is a rectangle: the tower leans, draws in
// toward its top, sits on an uneven foot and loses its merlons into a broken stump as it
// comes down. All of that is one path and one number — `rise`, one at full height and
// nought at rubble — so a hit is a single value settling rather than a drawing swapped out.
//
// Two components rather than one, and that is the whole reason this file is shaped the way
// it is. A tower is drawn in elevation on a sheet that is a plan, so it stands in front of
// the curtain wall it is built into and in front of whatever of the country is behind that
// — which is right, and which is what the face colour is for. But a number that has been
// covered is a number that cannot be dialled, so the numbers are a layer of their own above
// every wall, the way lettering goes on over the drawing on any map. `SiegeField` draws the
// rampart, then all the towers, then all the numbers.
//
// Neither component turns the sheet back out: the whole fight sits inside one turned-back
// view — see the note at the top of siege-field.tsx — so both are already upright, and both
// are placed in a frame where x runs along the wall and y runs down the ground.

// Town-mark's *plain* line weight rather than its walled one, and deliberately. The walled
// build is 2.2 on a wall whose merlons are 2.2 across; a stroke that wide on blocks this
// size would fuse the crenellations into a block. The camera supplies the heavier build for
// free — 1.2 at the siege zoom lands at nearly two and a half points on the screen, which
// is the weight a fortified town is drawn in.
const STROKE = 1.2
const COURSE = 0.7

// Room for the stroke and for however far the hand's lean and breaks carry past the block.
const PAD = 1 + TOWER_REACH

// How tall a box has to be to hold a tower at full height with its merlons on.
const BOX_W = TOWER_WIDTH + PAD * 2
const BOX_H = 36 + PAD * 2

// The disc the number sits in: the same round tower town-mark puts at the quarters of its
// wall, with the block rising out of it. Wide enough for three digits, which is as long as
// a sum on this dial gets.
export const TOWER_DISC = 8.5
const FONT = 7.5

// How long a tower takes to settle after a hit, and how long it waits before it starts.
//
// The wait is the stone's flight. A tower that gave the moment the key was pressed would be
// a tower damaged by the dial rather than by the shot crossing the ground at it — and the
// whole of what the stone is for is that the player sees the cause reach the effect. See
// siege-blow.tsx, which looses it.
const CHIP_MS = 220

export function SiegeTower({
  tower,
  x,
  y,
  seed,
  line,
  hatch,
  face,
}: {
  tower: Tower
  x: number
  y: number
  // This tower's own hand. Everything the drawing rolls — the lean, the uneven foot, where
  // the breaks fall — comes off this, so one tower is its own tower and the same one every
  // frame of the fight.
  seed: number
  line: string
  hatch: string
  // The ground's own colour, which is what every mark on this map knocks out with — and
  // here it is also what lets a tower stand in front of the wall it is built into.
  face: string
}) {
  const hand = towerHand(seed)
  const standing = tower.hits > 0 ? tower.left / tower.hits : 0
  const rise = useDerivedValue(() =>
    withDelay(STONE_MS, withTiming(standing, { duration: CHIP_MS })),
  )
  const block = useAnimatedProps(() => ({ d: towerBody(hand, rise.value) }))
  const stone = useAnimatedProps(() => ({ d: towerDetail(hand, rise.value) }))

  return (
    // A zero-size anchor on the point the tower stands on, which is its own foot on the
    // wall's foot line.
    <View
      pointerEvents="none"
      className="absolute"
      style={{ left: x, top: y, width: 0, height: 0 }}
    >
      <Svg
        width={BOX_W}
        height={BOX_H}
        viewBox={`${-BOX_W / 2} ${-BOX_H + PAD} ${BOX_W} ${BOX_H}`}
        style={{ position: 'absolute', left: -BOX_W / 2, top: -BOX_H + PAD }}
      >
        <AnimatedPath
          animatedProps={block}
          fill={face}
          stroke={line}
          strokeWidth={STROKE}
          strokeLinejoin="miter"
        />
        <AnimatedPath
          animatedProps={stone}
          fill="none"
          stroke={hatch}
          strokeWidth={COURSE}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

// How long the number takes to go and how long the new one takes to arrive, each. Half of
// it lands before the stone does and half after, so the digits are gone at the moment of the
// hit and the wall is asking something else by the time the dust is up.
const TURN_MS = 130

// The number a tower answers to, in the disc at its foot. Drawn after every tower on the
// wall — see the note at the top of this file.
//
// It changes with every hit a tower survives, which is the rule this component exists to
// carry: the wall never asks the same question twice, so three hits are three journeys
// across the dial rather than one answer found and then repeated. What is drawn is held
// here rather than read straight off the tower, because the swap has to happen *inside* the
// turn — a number that changed the instant the key was pressed would have answered before
// the stone was loosed, and one that waited for the dust would leave the old number sitting
// there to be dialled again.
export function TowerNumber({
  tower,
  x,
  y,
  ink,
  line,
  face,
}: {
  tower: Tower
  x: number
  y: number
  ink: string
  line: string
  face: string
}) {
  const [shown, setShown] = useState(tower.value)
  const turn = useSharedValue(1)

  useEffect(() => {
    if (shown === tower.value) return
    turn.value = withDelay(
      Math.max(0, STONE_MS - TURN_MS),
      withSequence(
        withTiming(0, { duration: TURN_MS }),
        withTiming(1, { duration: TURN_MS }),
      ),
    )
    const swap = setTimeout(() => {
      setShown(tower.value)
    }, STONE_MS)
    return () => {
      clearTimeout(swap)
    }
  }, [tower.value, shown])

  const turning = useAnimatedStyle(() => ({
    opacity: turn.value,
    transform: [{ scale: 0.72 + turn.value * 0.28 }],
  }))

  return (
    <View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={{
        left: x - TOWER_DISC,
        top: y - TOWER_DISC,
        width: TOWER_DISC * 2,
        height: TOWER_DISC * 2,
      }}
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
      <Animated.Text
        selectable={false}
        className="font-semibold"
        style={[{ fontFamily: mapLabel, color: ink, fontSize: FONT }, turning]}
      >
        {shown}
      </Animated.Text>
    </View>
  )
}
