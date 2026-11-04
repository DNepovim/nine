import { useLingui } from '@lingui/react/macro'
import { useRef, type ComponentType } from 'react'
import { View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import {
  LightsOut,
  LightsOutPull,
  LightsOutRemains,
} from '@/components/game/openings/lights-out'
import { MirrorDamage } from '@/components/game/openings/mirror-damage'
import {
  PassingEdge,
  PassingEdgeRemains,
  PassingEdgeUnder,
} from '@/components/game/openings/passing-edge'
import { Terminal } from '@/components/game/openings/terminal'
import { TrackedPressable } from '@/components/tracked-pressable'
import { LAYER } from '@/constants/layers'
import type { useOpening } from '@/hooks/use-opening'
import type { OpeningKind, OpeningTake } from '@/modes'
import type { Position } from '@/types/game'

// What every opening is handed. The scene owns its own timing and says two things back:
// `onSwitch` the moment the game screen should turn over to the mode's **scheme** — the
// click, on BLACKOUT — and `onDone` when it is over and the run may start.
export type OpeningSceneProps = {
  take: OpeningTake
  // How far an edge has swept the screen, for a scene that draws one; see `useOpening`.
  sweep: SharedValue<number>
  onSwitch: () => void
  onDone: () => void
}

// One scene per kind, the way `GLYPHS` draws a mark per kind: exhaustive over the union, so
// a new `OpeningKind` cannot ship without something to play.
const OPENINGS = {
  lightsOut: LightsOut,
  terminal: Terminal,
  passingEdge: PassingEdge,
} as const satisfies Record<OpeningKind, ComponentType<OpeningSceneProps>>

type Pull = ReturnType<typeof useOpening>['pull']

type OverProps = {
  pull: Pull
  onPeek: () => void
  livesLost: number
  livesLeft: number
  // Where the run's lost targets stood, in the window's measure.
  lostAt: readonly Position[]
}

// What each opening leaves on the game screen for the run once its scene is over — its
// **remains** — or null for one that leaves nothing. `Drawing` goes behind everything the run
// draws; `Over` goes in front of all of that, for what has to be touched there or seen there.
// Typed as the record rather than narrowed to its entries, so the null means something.
const REMAINS: Record<
  OpeningKind,
  {
    Drawing: ComponentType<{ lit: boolean; pull: Pull }>
    Over: ComponentType<OverProps> | null
  } | null
> = {
  lightsOut: { Drawing: LightsOutRemains, Over: LightsOutPull },
  terminal: null,
  passingEdge: { Drawing: PassingEdgeRemains, Over: MirrorDamage },
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

// What a scene needs under the run while it plays, for the one kind that draws anything there.
const UNDER: Record<OpeningKind, ComponentType<{ sweep: SharedValue<number> }> | null> = {
  lightsOut: null,
  terminal: null,
  passingEdge: PassingEdgeUnder,
}

export function OpeningUnder({
  kind,
  sweep,
}: {
  kind: OpeningKind | null
  sweep: SharedValue<number>
}) {
  const Under = kind === null ? null : UNDER[kind]
  return Under === null ? null : <Under sweep={sweep} />
}

// What the remains put in front of the run: a thing to pull, or damage that shows the run's
// lost hearts. Everything either of them might want, handed over the same way.
export function OpeningOver({
  kind,
  ...props
}: { kind: OpeningKind | null } & OverProps) {
  const Over = remainsOf(kind)?.Over
  return Over === undefined || Over === null ? null : <Over {...props} />
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
  sweep,
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
      <Scene take={take} sweep={sweep} onSwitch={onSwitch} onDone={finish} />
      <TrackedPressable
        id="opening.skip"
        onPress={finish}
        className="absolute inset-0"
        accessibilityLabel={t`Skip to the run`}
      />
    </View>
  )
}
