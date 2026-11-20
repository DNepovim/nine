import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg'

import { CASINO } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'

// The lever: how long the rod is.
const ROD = 76

// The lever on the right of the screen: a rod from its socket to a knob, the knob pulled down
// through the socket to below it. `pull` is nought up and one pulled. A box of its own, so it is
// all there is to touch when the player may pull it.
export const LEVER_W = 56

const LEVER_TOP = 16

export const LEVER_H = ROD * 2.9

export const LEVER_TRAVEL = ROD * 1.7

// Where down the screen the lever's socket is, as a share of its height.
const SOCKET_AT = 0.34

export function useLeverBox() {
  const { height } = useViewport()
  return { top: height * SOCKET_AT - ROD - LEVER_TOP }
}

const AnimatedLine = Animated.createAnimatedComponent(Line)

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const KNOB_ID = 'casino-knob'

const KNOB_R = 14

// The mount the rod passes through: a brass plate with a bolt at each end and a dark slot the rod
// sinks into, so a pull reads as going in somewhere rather than hanging in the air.
function Mount({ socket }: { socket: number }) {
  const mid = LEVER_W / 2
  return (
    <>
      <Rect
        transform={[{ translateX: mid - 14 }, { translateY: socket - 18 }]}
        width={28}
        height={36}
        rx={8}
        fill={CASINO.rod}
        stroke={CASINO.rodDark}
        strokeWidth={2}
      />
      <Rect
        transform={[{ translateX: mid - 4 }, { translateY: socket - 12 }]}
        width={8}
        height={24}
        rx={4}
        fill={CASINO.rodDark}
      />
      <Circle cx={mid} cy={socket - 14} r={1.8} fill={CASINO.rodLight} />
      <Circle cx={mid} cy={socket + 14} r={1.8} fill={CASINO.rodLight} />
    </>
  )
}

export function LeverDrawing({ pull }: { pull: SharedValue<number> }) {
  const socket = ROD + LEVER_TOP
  const mid = LEVER_W / 2
  const rod = useAnimatedProps(() => ({ y2: LEVER_TOP + pull.value * LEVER_TRAVEL }))
  const shine = useAnimatedProps(() => ({ y2: LEVER_TOP + pull.value * LEVER_TRAVEL }))
  const knob = useAnimatedProps(() => ({ cy: LEVER_TOP + pull.value * LEVER_TRAVEL }))
  const glint = useAnimatedProps(() => ({
    cy: LEVER_TOP - 5 + pull.value * LEVER_TRAVEL,
  }))
  return (
    <Svg width={LEVER_W} height={LEVER_H}>
      <Defs>
        <RadialGradient id={KNOB_ID} cx="35%" cy="30%" r="75%">
          <Stop offset="0%" stopColor={CASINO.knobLight} />
          <Stop offset="45%" stopColor={CASINO.knob} />
          <Stop offset="100%" stopColor={CASINO.knobDark} />
        </RadialGradient>
      </Defs>
      <Mount socket={socket} />
      <AnimatedLine
        x1={mid}
        y1={socket}
        x2={mid}
        stroke={CASINO.rodDark}
        strokeWidth={8}
        strokeLinecap="round"
        animatedProps={rod}
      />
      <AnimatedLine
        x1={mid - 1}
        y1={socket}
        x2={mid - 1}
        stroke={CASINO.rodLight}
        strokeWidth={3}
        strokeLinecap="round"
        animatedProps={shine}
      />
      <AnimatedCircle
        cx={mid}
        r={KNOB_R}
        fill={`url(#${KNOB_ID})`}
        stroke={CASINO.knobRim}
        strokeWidth={1.5}
        animatedProps={knob}
      />
      <AnimatedCircle
        cx={mid - 5}
        r={3.2}
        fill={CASINO.flash}
        opacity={0.85}
        animatedProps={glint}
      />
    </Svg>
  )
}
