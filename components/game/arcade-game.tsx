import { Trans } from '@lingui/react/macro'
import { isOneOf } from 'narrowland'
import { useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ArcadeDawn } from '@/components/game/arcade-dawn'
import { ArcadeOver } from '@/components/game/arcade-over'
import { ArcadePaused } from '@/components/game/arcade-paused'
import { ArcadeSheet } from '@/components/game/arcade-sheet'
import { ArcadeVitals } from '@/components/game/arcade-vitals'
import { CompassRose } from '@/components/game/compass-rose'
import { Dial } from '@/components/game/dial'
import { RunTopBar } from '@/components/game/run-top-bar'
import { ScoreDigit } from '@/components/game/score-digit'
import { ScreenLayer } from '@/components/screen'
import { ANCHOR, STEM_BOX } from '@/constants/arcade'
import { ARCADE_INK, MAP_INK, SURFACE } from '@/constants/colors'
import { useArcadeCamera } from '@/hooks/use-arcade-camera'
import { useArcadeLand } from '@/hooks/use-arcade-land'
import { useArcadeRun, type ArcadePhase } from '@/hooks/use-arcade-run'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { canvasOf } from '@/lib/arcade-canvas'
import { ambushFrame, pitchFor, siegeFrame, type SiegeFrame } from '@/lib/arcade-layout'
import { valueProgress } from '@/lib/value-progress'
import { ARCADE_DIAL } from '@/machines/arcade'
import type { DialControl } from '@/machines/tutorial-lesson'
import { cellsOf, darkGradientOf, sumOf } from '@/modes'

// The arcade screen: the way above, the dial below, and nothing between them but the sum.
//
// A screen of its own rather than a branch inside the game screen: an arcade run is not the
// game machine's run — no score, no lives, no board — so there was nothing there for it to
// join.
//
// A `ScreenLayer`, which is what puts it on the app's own stack. A plain absolute view was
// the first try, copied from the multiplayer game, and it was invisible: the intro is a
// screen at `LAYER.screen`, and a sibling with no z-index of its own paints *under* it
// however late it is mounted. Multiplayer gets away with it because the intro unmounts under
// a shared run; the intro steps aside for this one too — see `onIntro` — so this is the one
// settled screen while it is up, and it arrives and leaves on the same fades every other
// screen does.
//
// The canvas is drawn in one fixed frame, measured from the crossroad the run began on and
// never re-based. That is the decision the whole screen rests on: the camera is a shared
// value and the map is React state, so if positions were relative to wherever the hero is
// now, every arrival would have to shift the map and reset the camera by the same vector in
// the same frame. In one fixed frame an arrival moves nothing that is already drawn.

const ALL_OFF: readonly DialControl[] = cellsOf(ARCADE_DIAL).map(() => 'off')

// The beats the camera is in close for, which is those four less `taken`: the walls coming
// down is the camera letting go, and it opens out while the hero is still walking in — so
// the fan the village blooms into arrives on a sheet already back at rest.
// An ambush is in close for the same three of its own four, and for the same reason:
// `cleared` is the camera letting go while the hero walks the rest of its way, so the fan at
// the far end blooms onto a sheet already back at rest. `driven` lets go too — being dragged
// home is a journey across the map rather than a fight on it.
// The beats the hero is standing on a road rather than at a crossroad or a gate. What they
// share is the framing: the stop partway along the way, and the camera that put it there.
const AMBUSH_PHASES: readonly ArcadePhase[] = ['springing', 'ambush', 'cleared', 'driven']

// And which framing this beat is looked at under. Both answer the same two questions — how
// far along the way the hero holds, and what the camera does to put it there — so the screen
// reads one shape and never asks which fight it is in.
const frameFor = (
  phase: ArcadePhase,
  width: number,
  height: number,
  reach: number,
): SiegeFrame =>
  isOneOf(phase, AMBUSH_PHASES)
    ? ambushFrame(width, height, reach)
    : siegeFrame(height, reach)

export function ArcadeGame({
  drag,
  onEnd,
}: {
  // Whether one gesture may move more than one key, as the player has it set. The map is
  // walked on the same keys as a run on the dial, so it takes the same answer.
  drag: boolean
  onEnd: () => void
}) {
  const insets = useSafeAreaInsets()
  const run = useArcadeRun()
  const [canvas, setCanvas] = useState({ width: 0, height: 0 })

  const pitch = pitchFor(canvas.height)
  const box = Math.ceil(pitch * STEM_BOX)
  const here = run.standing
  const anchorX = canvas.width / 2
  const anchorY = canvas.height * ANCHOR

  // How this fight is framed, if what the hero is walking to or standing under has walls.
  //
  // Measured along the way in, which is a different way each time: a long way and a short
  // one have to leave the same ground in front of the wall, so the stand-off is worked out
  // of the canvas rather than written down. The reach is read off whichever way the hero is
  // on — the one it is walking, the far one of a strike, or the one behind it while it
  // stands at the gate.
  const wayIn =
    run.phase === 'rocket'
      ? run.through
      : (run.moving ?? run.parent?.ways.find((way) => way.to === here?.id) ?? null)
  const frame = frameFor(run.phase, canvas.width, canvas.height, wayIn?.reach ?? 1)
  // And the ring the band stands on, which only an ambush has and which the field needs
  // whether or not the camera is framing one yet.
  const road = ambushFrame(canvas.width, canvas.height, wayIn?.reach ?? 1)

  const camera = useArcadeCamera({ run, pitch, canvasHeight: canvas.height, frame })
  const { camTurn, northUp, setNorthUp } = camera

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setCanvas({ width, height })
  }

  const drawn = canvasOf({ run, pitch, standoff: frame.standoff })
  const { dawn } = drawn

  // What the land is, where the hero is standing. A pure function of the world and the run's
  // seed — see hooks/use-arcade-land.ts for why the answers are kept.
  const land = useArcadeLand({
    seed: run.seed,
    pitch,
    canvas,
    origin: here?.pos ?? { x: 0, y: 0 },
    sight: run.sight,
  })

  const sum = sumOf(ARCADE_DIAL, run.grid)
  const direction = useScoreDirection(sum)
  // What every mark on the map fills itself with before it is inked: the theme's own ground,
  // so the knockout is invisible except where it covers something.

  return (
    <ScreenLayer>
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {/* ── Top bar ── */}
        {/* The same bar every run is played under. The place the hero is standing in
            goes where a rung goes in the game's own: the depth is the score and is on the
            pause screen and the end of the run, and what a player wants to read mid-run
            is where they are — every crossroad has had a name since the map started
            drawing itself one.

            The way out shows only while the hero is standing on a crossroad. Mid-flight
            there is no beat to stop: a movement is a second at most, and a screen that
            froze halfway along a way would have to be resumed into an animation that had
            already finished without it. */}
        <View className="px-4 py-2">
          <RunTopBar
            accent={ARCADE_INK}
            title={<Trans>ADVENTURE</Trans>}
            subtitle={here?.name.toUpperCase() ?? ''}
            wordmark={ARCADE_INK}
            onPause={run.dialable ? run.pause : null}
          />
          <ArcadeVitals
            hearts={run.hearts}
            satiety={run.satiety}
            starving={run.starving}
          />
        </View>

        {/* ── The way ── */}
        {/* Clipped, because the map runs well past what is worth looking at: the canvas is a
          window onto the climb rather than the whole of it. */}
        <View className="flex-1 overflow-hidden" onLayout={onCanvasLayout}>
          {/* The sheet. Mounted when the card leaves, and fading up over exactly as long as
            the card takes to go, so the two are one handover rather than a swap. */}
          <ArcadeSheet
            run={run}
            drawn={drawn}
            camera={camera}
            land={land}
            pitch={pitch}
            box={box}
            canvasWidth={canvas.width}
            anchorX={anchorX}
            anchorY={anchorY}
            ground={road.ground}
          />

          {/* Over the sheet rather than on it: the rose is a control and a reading, and
              neither belongs to the part that turns. Left mounted under the card rather
              than arriving with the sheet: a control that popped in after the words would
              be one more thing moving at the one moment the map is asking to be read. */}
          <CompassRose
            turn={camTurn}
            northUp={northUp}
            line={MAP_INK.line}
            hatch={MAP_INK.hatch}
            knockout={SURFACE}
            onToggle={() => {
              setNorthUp((was) => !was)
            }}
          />

          {/* The words the run opens on, over the canvas and nothing else: the dial stays
              where it is, dimmed, so the first thing a player sees of arcade is the place
              being set out rather than a board already dealt. */}
          {dawn && <ArcadeDawn ink={ARCADE_INK} />}
        </View>

        {/* ── The sum ── */}
        {/* Reserved, so the dial sits at one height whatever the sum reads. */}
        <View className="items-center justify-center" style={{ height: SUM_ROW_HEIGHT }}>
          <View className="flex-row">
            {String(sum)
              .split('')
              .map((digit, i, all) => (
                <ScoreDigit
                  key={all.length - 1 - i}
                  digit={digit}
                  direction={direction}
                  progress={valueProgress(sum, ARCADE_DIAL.maxSum)}
                />
              ))}
          </View>
        </View>

        {/* ── Dial ── */}
        {/* Every key shut while the hero is moving: the answer has been given, and a key
          pressed mid-walk would be answering a crossroad nobody is standing on. */}
        <Dial
          dial={ARCADE_DIAL}
          values={run.grid.flat()}
          showSum={false}
          trainee={false}
          drag={drag}
          controls={run.dialable ? undefined : ALL_OFF}
          peakFrom={darkGradientOf('arcade')[0]}
          peakTo={darkGradientOf('arcade')[1]}
          onDelta={run.press}
          onSet={run.set}
        />

        {/* Stopped. The canvas stays exactly as it was underneath — the red on the way
            behind holds where it got to — so continuing is the screen leaving rather than
            the board being dealt again. */}
        {run.paused && (
          <ArcadePaused
            depth={run.depth}
            strikes={run.strikes}
            taken={run.taken}
            playedMs={run.playedMs}
            onContinue={run.resume}
            onEnd={onEnd}
          />
        )}

        {run.phase === 'over' && (
          <ArcadeOver
            // Which of the two ends this was. There is no flag for it and there does not
            // need to be: `falling` is written at exactly one place, under `from == null`,
            // so a hero that fell has no crossroad behind it by construction — and a hero
            // overrun at a village always does, because it walked there.
            overrun={run.parent !== undefined}
            depth={run.best}
            strikes={run.strikes}
            taken={run.taken}
            playedMs={run.playedMs}
            onAgain={run.restart}
            onHome={onEnd}
          />
        )}
      </View>
    </ScreenLayer>
  )
}
