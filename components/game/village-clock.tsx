import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { TOWN_BOX } from '@/components/game/town-mark'
import { BUD_SIZE } from '@/constants/arcade'

// How long the village at a way's end will hold out, drawn as a ring draining inside its
// wall.
//
// This ring was already here as a plain circle in TownMark, where its own comment called it
// "the one part of this that is the game speaking rather than the map". It is a file of its
// own now because it has something to say: every village at a crossroad holds out for its
// own length of time, and the player has to be able to read which one is about to go
// without being told.
//
// On the frame clock rather than on a timing animation. The run hands down the wall-clock
// moment this village gives up, and the sheet is already sampling `Date.now()` once a frame
// for the siege — so the ring is worked out in a worklet off a stamp that a pause shifts,
// and a paused run's rings simply stop where they are. A `withTiming` to zero would have to
// be cancelled and restarted on every pause, and would drift from the timer that actually
// ends the crossroad.

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const MID = TOWN_BOX / 2
// Inside the wall, where the amber ring has always sat: the merlons and the towers have
// already said wall, and a second ring outside them would only crowd the fan.
const R = BUD_SIZE / 2 - 1 - 3.5
const CIRCUMFERENCE = 2 * Math.PI * R
const STROKE = 1.6

export function VillageClock({
  now,
  // The wall-clock moment this village gives up, and how long it had in total. Null before
  // the fan has finished drawing itself — the clocks do not start until the crossroad is
  // open, which is the head start a fast player has always had.
  endsAt,
  clockMs,
  edge,
}: {
  now: SharedValue<number>
  endsAt: number | null
  clockMs: number
  edge: string
}) {
  const ring = useAnimatedProps(() => {
    // Full while nothing is counting, so the ring is a ring from the moment the town is
    // drawn rather than appearing when the clock starts.
    const left =
      endsAt === null || clockMs <= 0
        ? 1
        : Math.min(1, Math.max(0, (endsAt - now.value) / clockMs))
    return { strokeDashoffset: CIRCUMFERENCE * (1 - left) }
  })

  return (
    <Svg
      width={TOWN_BOX}
      height={TOWN_BOX}
      pointerEvents="none"
      style={{ position: 'absolute' }}
    >
      <AnimatedCircle
        cx={MID}
        cy={MID}
        r={R}
        fill="none"
        stroke={edge}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        animatedProps={ring}
        // Drained from the top, clockwise, which is the direction every clock in this app
        // runs: the countdown pie, and the red creeping up the way behind.
        transform={`rotate(-90 ${MID} ${MID})`}
      />
    </Svg>
  )
}
