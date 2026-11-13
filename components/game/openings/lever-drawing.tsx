import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'

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

export function LeverDrawing({ pull }: { pull: SharedValue<number> }) {
  const socket = ROD + LEVER_TOP
  const rod = useAnimatedProps(() => ({ y2: LEVER_TOP + pull.value * LEVER_TRAVEL }))
  const knob = useAnimatedProps(() => ({ cy: LEVER_TOP + pull.value * LEVER_TRAVEL }))
  return (
    <Svg width={LEVER_W} height={LEVER_H}>
      <AnimatedLine
        x1={LEVER_W / 2}
        y1={socket}
        x2={LEVER_W / 2}
        stroke={CASINO.rod}
        strokeWidth={6}
        strokeLinecap="round"
        animatedProps={rod}
      />
      <Circle cx={LEVER_W / 2} cy={socket} r={9} fill={CASINO.rod} />
      <AnimatedCircle
        cx={LEVER_W / 2}
        r={13}
        fill={CASINO.knob}
        stroke={CASINO.knobRim}
        strokeWidth={2}
        animatedProps={knob}
      />
    </Svg>
  )
}
