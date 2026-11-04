import { useLingui } from '@lingui/react/macro'
import { useRef, type ComponentType } from 'react'
import { View } from 'react-native'

import {
  LightsOut,
  LightsOutPull,
  LightsOutRemains,
} from '@/components/game/openings/lights-out'
import { Terminal } from '@/components/game/openings/terminal'
import { TrackedPressable } from '@/components/tracked-pressable'
import { LAYER } from '@/constants/layers'
import type { useOpening } from '@/hooks/use-opening'
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
  terminal: Terminal,
} as const satisfies Record<OpeningKind, ComponentType<OpeningSceneProps>>

type Pull = ReturnType<typeof useOpening>['pull']

// What each opening leaves on the game screen for the run once its scene is over — its
// **remains** — or null for one that leaves nothing. The drawing goes behind everything the
// run draws; `Pull` is how a finger reaches it, above all of that. Typed as the record rather
// than narrowed to its entries, so the null means something.
const REMAINS: Record<
  OpeningKind,
  {
    Drawing: ComponentType<{ lit: boolean; pull: Pull }>
    Pull: ComponentType<{ pull: Pull; onPeek: () => void }>
  } | null
> = {
  lightsOut: { Drawing: LightsOutRemains, Pull: LightsOutPull },
  terminal: null,
}

const remainsOf = (kind: OpeningKind | null) => (kind === null ? null : REMAINS[kind])

export function OpeningRemains({
  kind,
  lit,
  pull,
}: {
  kind: OpeningKind | null
  lit: boolean
  pull: Pull
}) {
  const Drawing = remainsOf(kind)?.Drawing
  return Drawing === undefined ? null : <Drawing lit={lit} pull={pull} />
}

export function OpeningPull({
  kind,
  pull,
  onPeek,
}: {
  kind: OpeningKind | null
  pull: Pull
  onPeek: () => void
}) {
  const Reach = remainsOf(kind)?.Pull
  return Reach === undefined ? null : <Reach pull={pull} onPeek={onPeek} />
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
