import { View } from 'react-native'

// The mouth: the ring hanging below the crossroad a run began on, at the foot of the stub.
// What the hero falls into when the clock wins there, and the only way a run ends.
//
// Drawn as a ring rather than filled, because it is a hole. The ember at its centre is the
// one warm thing on the canvas that is not the hero — the run's own colour, waiting.
const SIZE = 24
const EYE = 7

export function ArcadeMouth({
  x,
  y,
  fade,
  ring,
  ember,
}: {
  x: number
  y: number
  fade: number
  ring: string
  ember: string
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute items-center justify-center rounded-full"
      style={{
        left: x - SIZE / 2,
        top: y - SIZE / 2,
        width: SIZE,
        height: SIZE,
        borderWidth: 1.5,
        borderColor: ring,
        opacity: fade,
      }}
    >
      <View
        className="rounded-full"
        style={{ width: EYE, height: EYE, backgroundColor: ember }}
      />
    </View>
  )
}
