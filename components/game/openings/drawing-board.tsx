import { useEffect } from 'react'
import { View } from 'react-native'
import { Easing, withDelay, withTiming } from 'react-native-reanimated'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import type { OpeningTake } from '@/modes'

// FOUR KEYS' **opening**: the drawing board being drawn on.
//
// There is nothing in this scene to look at; what it plays is the screen making itself. It runs
// `sweep` from nought to one, and the dial reads that as the drawing — the square is ruled,
// cut into four, the keys come up in grey, and the dimensions are drawn and written round it
// (`DRAW` in lib/dial-sketch.ts, `DialSketch`), and the top bar's items are drawn in over the same
// sweep, one after another (`PencilWipe`).
//
// The `short` take is the same drawing done quickly, for a run dealt again.

// When each beat lands, in ms from the scene's start, per take: how long the sheet stays blank,
// how long the drawing takes, and the end.
const BEATS = {
  full: { wait: 350, draw: 2300, done: 2800 },
  short: { wait: 0, draw: 520, done: 640 },
} as const satisfies Record<OpeningTake, { wait: number; draw: number; done: number }>

export function DrawingBoard({ take, sweep, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]

  useEffect(() => {
    sweep.value = 0
    sweep.value = withDelay(
      beats.wait,
      withTiming(1, { duration: beats.draw, easing: Easing.inOut(Easing.quad) }),
    )
    // The scheme is the board's from the first frame; there is no screen to turn over.
    onSwitch()
    const done = setTimeout(onDone, beats.done)
    return () => {
      clearTimeout(done)
      // A skip lands here with the drawing half made. Whole, so the run starts on a finished
      // board; assigning also stops what was still running.
      sweep.value = 1
    }
  }, [])

  return <View className="absolute inset-0" pointerEvents="none" aria-hidden />
}
