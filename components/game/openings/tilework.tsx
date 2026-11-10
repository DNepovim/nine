import { useEffect } from 'react'
import { View } from 'react-native'
import { Easing, withDelay, withTiming, type SharedValue } from 'react-native-reanimated'

import type { OpeningSceneProps } from '@/components/game/opening-layer'
import { TileWall } from '@/components/game/tile-wall'
import type { OpeningTake } from '@/modes'

// FOUR BY FOUR's **opening**: a wall being tiled.
//
// The scene itself draws nothing: it runs `sweep` from nought to one, and the wall behind the run
// (`TileWall`, drawn under the screen while the scene plays) lays its tiles in a wave from the
// top-left corner as `sweep` reaches them. When the wave is through the wall is simply there, as
// the scene's **remains**, and stays behind the run — the keys and the targets are tiles of it.
//
// The `short` take is the same wave quickly, for a run dealt again.

const BEATS = {
  full: { wait: 250, lay: 1700, done: 2300 },
  short: { wait: 0, lay: 420, done: 520 },
} as const satisfies Record<OpeningTake, { wait: number; lay: number; done: number }>

// The wall as the scene's `Under`, laid as `sweep` goes.
export function TileworkUnder({ sweep }: { sweep: SharedValue<number> }) {
  return <TileWall sweep={sweep} />
}

// The wall as what the scene leaves behind, whole, for as long as the run lasts.
export function TileworkRemains() {
  return <TileWall />
}

export function Tilework({ take, sweep, onSwitch, onDone }: OpeningSceneProps) {
  const beats = BEATS[take]

  useEffect(() => {
    sweep.value = 0
    sweep.value = withDelay(
      beats.wait,
      withTiming(1, { duration: beats.lay, easing: Easing.inOut(Easing.quad) }),
    )
    // The scheme is the panel's from the first frame; there is no screen to turn over.
    onSwitch()
    const done = setTimeout(onDone, beats.done)
    return () => {
      clearTimeout(done)
      sweep.value = 1
    }
  }, [])

  return <View className="absolute inset-0" pointerEvents="none" aria-hidden />
}
