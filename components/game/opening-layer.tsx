import { useLingui } from '@lingui/react/macro'
import { useRef, type ComponentType } from 'react'
import { View } from 'react-native'

import { LightsOut, LightsOutRemains } from '@/components/game/openings/lights-out'
import { TrackedPressable } from '@/components/tracked-pressable'
import { LAYER } from '@/constants/layers'
import type { OpeningKind, OpeningTake } from '@/modes'

// What every opening is handed. The scene owns its own timing and says two things back:
// `onSwitch` the moment the game screen should turn over to the mode's **scheme** — the
// click, on BLACKOUT — and `onDone` when it is over and the run may start.
export type OpeningSceneProps = {
  take: OpeningTake
  onSwitch: () => void
  onDone: () => void
}

// One scene per kind, the way `GLYPHS` draws a mark per kind: exhaustive over the union, so
// a new `OpeningKind` cannot ship without something to play.
const OPENINGS = {
  lightsOut: LightsOut,
} as const satisfies Record<OpeningKind, ComponentType<OpeningSceneProps>>

// What each opening leaves behind for the run that follows it — its **remains** — or null
// for a scene that leaves nothing. Drawn by `OpeningRemains` behind the game, for as long
// as the run lasts.
// Typed as the record rather than narrowed to its entries, so a kind whose scene leaves
// nothing is a `null` here and the check below means something.
const REMAINS: Record<OpeningKind, ComponentType | null> = {
  lightsOut: LightsOutRemains,
}

export function OpeningRemains({ kind }: { kind: OpeningKind }) {
  const Remains = REMAINS[kind]
  return Remains === null ? null : <Remains />
}

// A mode's **opening**, over the game screen while its run is held **ready**.
//
// Mounted only while the machine is in `ready`, and keyed on the run by the screen, so
// every run plays its scene from the start. A tap anywhere skips it: the scene is a moment,
// not a gate, and a player twenty retries in should never have to wait one out.
//
// `onDone` is said once whichever way the scene ends. A skip lands it early, and the
// scene's own timers may still be running into the frame the layer unmounts in — the
// guard is what keeps that from starting the run a second time.
export function OpeningLayer({
  kind,
  take,
  onSwitch,
  onDone,
}: {
  kind: OpeningKind
} & OpeningSceneProps) {
  const { t } = useLingui()
  const finished = useRef(false)
  const finish = () => {
    if (finished.current) return
    finished.current = true
    onDone()
  }
  const Scene = OPENINGS[kind]
  return (
    <View
      className="absolute inset-0"
      style={{ zIndex: LAYER.screen }}
      pointerEvents="box-none"
    >
      <Scene take={take} onSwitch={onSwitch} onDone={finish} />
      <TrackedPressable
        id="opening.skip"
        onPress={finish}
        className="absolute inset-0"
        accessibilityLabel={t`Skip to the run`}
      />
    </View>
  )
}
