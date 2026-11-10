import { useLingui } from '@lingui/react/macro'
import { useRef, type ComponentType } from 'react'
import { View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import {
  beatsClearIn,
  Defibrillator,
  DefibrillatorRemains,
  DefibrillatorUnder,
} from '@/components/game/openings/defibrillator'
import { DrawingBoard } from '@/components/game/openings/drawing-board'
import {
  FrostCreep,
  FrostRemains,
  FrostUnder,
} from '@/components/game/openings/frost-creep'
import { LavaLamp, LavaRemains } from '@/components/game/openings/lava-lamp'
import {
  CasinoRemains,
  LeverOver,
  LeverPull,
  lightsOutLeft,
} from '@/components/game/openings/lever-pull'
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
import {
  StormFront,
  StormRemains,
  StormUnder,
} from '@/components/game/openings/storm-front'
import {
  crashFireLeft,
  PlaneOver,
  SkyRemains,
  SkyUnder,
  Takeoff,
} from '@/components/game/openings/takeoff'
import { Terminal } from '@/components/game/openings/terminal'
import {
  Tilework,
  TileworkRemains,
  TileworkUnder,
} from '@/components/game/openings/tilework'
import { TrackedPressable } from '@/components/tracked-pressable'
import { LAYER } from '@/constants/layers'
import type { useOpening } from '@/hooks/use-opening'
import type { RunFigures } from '@/lib/vitals'
import type { OpeningKind, OpeningTake } from '@/modes'
import type { Position } from '@/types/game'

// What every opening is handed. The scene owns its own timing and says two things back:
// `onSwitch` the moment the game screen should turn over to the mode's **scheme** — the
// click, on BLACKOUT — and `onDone` when it is over and the run may start.
export type OpeningSceneProps = {
  take: OpeningTake
  // How far an edge has swept the screen, for a scene that draws one; see `useOpening`.
  sweep: SharedValue<number>
  // How lit the rows above the dial are, nought to one, for a scene that darkens them and lights
  // them again; see `useOpening`.
  barLight: SharedValue<number>
  // Shuffles the dial under the scene, for one that does.
  onShuffle: () => void
  onSwitch: () => void
  onDone: () => void
}

// One scene per kind, the way `GLYPHS` draws a mark per kind: exhaustive over the union, so
// a new `OpeningKind` cannot ship without something to play.
const OPENINGS = {
  lightsOut: LightsOut,
  terminal: Terminal,
  passingEdge: PassingEdge,
  stormFront: StormFront,
  frostCreep: FrostCreep,
  defibrillator: Defibrillator,
  takeoff: Takeoff,
  leverPull: LeverPull,
  drawingBoard: DrawingBoard,
  tilework: Tilework,
  lavaLamp: LavaLamp,
} as const satisfies Record<OpeningKind, ComponentType<OpeningSceneProps>>

type Pull = ReturnType<typeof useOpening>['pull']

type OverProps = {
  pull: Pull
  onPeek: () => void
  livesLost: number
  livesLeft: number
  // Where the run's lost targets stood, in the window's measure.
  lostAt: readonly Position[]
  // Whether the run is being played, which run it is and the dial as it stands (a new value for
  // every press), for the remains that fly with the player's hand — and `onEnd`, which ends the
  // run from there, as a plane meeting the ground does.
  running: boolean
  finished: boolean
  runId: string
  grid: unknown
  onEnd: () => void
  // Shuffles the dial, for the remains that hand the player a way to.
  onShuffle: () => void
}

// What each opening leaves on the game screen for the run once its scene is over — its
// **remains** — or null for one that leaves nothing. `Drawing` goes behind everything the run
// draws; `Over` goes in front of all of that, for what has to be touched there or seen there.
// Typed as the record rather than narrowed to its entries, so the null means something.
const REMAINS: Record<
  OpeningKind,
  {
    Drawing: ComponentType<{
      lit: boolean
      pull: Pull
      running: boolean
      finished: boolean
      runId: string
      grid: unknown
      figures: RunFigures
    }>
    Over: ComponentType<OverProps> | null
  } | null
> = {
  lightsOut: { Drawing: LightsOutRemains, Over: LightsOutPull },
  terminal: null,
  passingEdge: { Drawing: PassingEdgeRemains, Over: MirrorDamage },
  stormFront: { Drawing: StormRemains, Over: null },
  frostCreep: { Drawing: FrostRemains, Over: null },
  defibrillator: { Drawing: DefibrillatorRemains, Over: null },
  takeoff: { Drawing: SkyRemains, Over: PlaneOver },
  leverPull: { Drawing: CasinoRemains, Over: LeverOver },
  // The drawing is the dial's and the bar's own; the scene leaves nothing behind it.
  drawingBoard: null,
  // The wall stays behind the run, under the dial: the keys and the targets are tiles of it.
  tilework: { Drawing: TileworkRemains, Over: null },
  // Three slow lumps of wax stay behind the run, faint, behind the dial.
  lavaLamp: { Drawing: LavaRemains, Over: null },
}

// How long, in ms, what a kind's remains are still doing needs once a run ends — or null for a
// kind whose remains have nothing to wait for. The last-life cinematic holds off until it has
// run out: NO SLIP's last beat crosses the monitor and leaves a flat line.
const HOLDS: Record<OpeningKind, (() => number) | null> = {
  lightsOut: null,
  terminal: null,
  passingEdge: null,
  stormFront: null,
  frostCreep: null,
  defibrillator: beatsClearIn,
  takeoff: crashFireLeft,
  leverPull: lightsOutLeft,
  drawingBoard: null,
  tilework: null,
  lavaLamp: null,
}

export const remainsHoldOf = (kind: OpeningKind | null) =>
  kind === null ? null : HOLDS[kind]

const remainsOf = (kind: OpeningKind | null) => (kind === null ? null : REMAINS[kind])

export function OpeningRemains({
  kind,
  lit,
  pull,
  running,
  finished,
  runId,
  grid,
  figures,
}: {
  kind: OpeningKind | null
  lit: boolean
  pull: Pull
  // Whether the run is being played this moment, and which run it is — for the remains that
  // change over the run, as the storm's water rises.
  running: boolean
  // The run is over, for the remains that have something to do about it.
  finished: boolean
  runId: string
  // The dial as it stands, which is a new value for every press — for the remains that answer
  // to the player's hand, as NO SLIP's monitor beats.
  grid: unknown
  // How the run is going, for the remains that read it, as NO SLIP's monitor does.
  figures: RunFigures
}) {
  const Drawing = remainsOf(kind)?.Drawing
  return Drawing === undefined ? null : (
    <Drawing
      lit={lit}
      pull={pull}
      running={running}
      finished={finished}
      runId={runId}
      grid={grid}
      figures={figures}
    />
  )
}

// What a scene needs under the run while it plays, for the one kind that draws anything there.
const UNDER: Record<OpeningKind, ComponentType<{ sweep: SharedValue<number> }> | null> = {
  lightsOut: null,
  terminal: null,
  passingEdge: PassingEdgeUnder,
  stormFront: StormUnder,
  frostCreep: FrostUnder,
  defibrillator: DefibrillatorUnder,
  takeoff: SkyUnder,
  leverPull: null,
  drawingBoard: null,
  tilework: TileworkUnder,
  lavaLamp: null,
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
  barLight,
  onShuffle,
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
      <Scene
        take={take}
        sweep={sweep}
        barLight={barLight}
        onShuffle={onShuffle}
        onSwitch={onSwitch}
        onDone={finish}
      />
      <TrackedPressable
        id="opening.skip"
        onPress={finish}
        className="absolute inset-0"
        accessibilityLabel={t`Skip to the run`}
      />
    </View>
  )
}
