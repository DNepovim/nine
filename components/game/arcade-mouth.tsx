import { View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { tiltedAt, type Sheet } from '@/lib/arcade-tilt'

// The mouth: the ring hanging below the crossroad a run began on, at the foot of the stub.
// What the hero falls into when the clock wins there — one of the two ways a run ends, the
// other being overrun at a walled village, which happens where it was fought and never
// here.
//
// Drawn as a ring rather than filled, because it is a hole. The ember at its centre is the
// one warm thing on the canvas that is not the hero — the run's own colour, waiting.
//
// It takes the sheet's tilt like any other mark. It hangs below the crossroad the run began
// on, so it is nearer the reader than anything else drawn and is the one thing on the map the
// tilt makes *larger* — the hole the run can fall into, right under the player's feet.
const SIZE = 24
const EYE = 7

export function ArcadeMouth({
  x,
  y,
  sheet,
  fade,
  ring,
  ember,
}: {
  x: number
  y: number
  // The camera, which is what says where this hole is drawn and how wide.
  sheet: SharedValue<Sheet>
  fade: number
  ring: string
  ember: string
}) {
  const lie = useAnimatedStyle(() => {
    const at = tiltedAt(sheet.value, x, y)
    return {
      transform: [
        { translateX: at.x - x },
        { translateY: at.y - y },
        { scale: at.scale },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center rounded-full"
      style={[
        {
          left: x - SIZE / 2,
          top: y - SIZE / 2,
          width: SIZE,
          height: SIZE,
          borderWidth: 1.5,
          borderColor: ring,
          opacity: fade,
        },
        lie,
      ]}
    >
      <View
        className="rounded-full"
        style={{ width: EYE, height: EYE, backgroundColor: ember }}
      />
    </Animated.View>
  )
}
