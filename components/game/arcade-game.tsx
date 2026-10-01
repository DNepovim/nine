import { Trans } from '@lingui/react/macro'
import { isOneOf } from 'narrowland'
import { useEffect, useRef, useState } from 'react'
import { Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ArcadeDawn } from '@/components/game/arcade-dawn'
import { ArcadeHero } from '@/components/game/arcade-hero'
import { ArcadeMouth } from '@/components/game/arcade-mouth'
import { ArcadeOver } from '@/components/game/arcade-over'
import { ArcadePaused } from '@/components/game/arcade-paused'
import { ArcadeStrike } from '@/components/game/arcade-strike'
import { CompassRose } from '@/components/game/compass-rose'
import { Dial } from '@/components/game/dial'
import { LandMark } from '@/components/game/land-mark'
import { PauseButton } from '@/components/game/pause-button'
import { ScoreDigit } from '@/components/game/score-digit'
import { VillageArrival } from '@/components/game/village-arrival'
import { WayBud, type BudState } from '@/components/game/way-bud'
import { WayStem, type StemState } from '@/components/game/way-stem'
import { ScreenLayer } from '@/components/screen'
import {
  ANCHOR,
  DAWN_OUT_MS,
  FALL_MS,
  RETREAT_MS,
  ROCKET_MS,
  ROCKET_SPLIT,
  STAGGER_MS,
  STEM_BOX,
  TRAIL_DEPTH,
  WALK_MS,
} from '@/constants/arcade'
import { ARCADE_INK, MAP_INK, PIE_INK, SURFACE } from '@/constants/colors'
import { useArcadeLand } from '@/hooks/use-arcade-land'
import { useArcadeRun, type ArcadePhase } from '@/hooks/use-arcade-run'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { useTheme } from '@/hooks/use-theme'
import {
  mouthStub,
  pitchFor,
  pointsOf,
  splineFor,
  type Spline,
} from '@/lib/arcade-layout'
import { DIAL_CELLS } from '@/lib/dial-gesture'
import { valueProgress } from '@/lib/value-progress'
import { idSeed, UP } from '@/machines/arcade'
import { computeSum, DARK_MODE_GRADIENT, lerpColor, MODE_GRADIENT } from '@/machines/game'
import type { DialControl } from '@/machines/tutorial-lesson'

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

const [EMBER, AMBER] = MODE_GRADIENT.arcade
const HERO_CORE = lerpColor(AMBER, '#FFFFFF', 0.62)

// The amber at a little under half, which is as much edge as a bud can take before the ring
// starts competing with the numeral inside it.
const BUD_EDGE = `${AMBER}73`

// How far back the hero's own history stays legible. The way it is standing on is at full
// strength; what is behind that is there to say where the run came from.
const FADES = [1, 0.45, 0.2] as const

const ALL_OFF: readonly DialControl[] = DIAL_CELLS.map(() => 'off')

// How long the canvas takes to drift, per beat — the same number the hero's own travel
// takes, because they are one movement: the hero walks, and the canvas keeps it anchored.
const DRIFT_MS = {
  dawn: 0,
  bloom: 0,
  open: 0,
  walk: WALK_MS,
  // Two ways in a little over one walk, which is the whole feel of a strike: the canvas
  // covers twice the ground in not much more time, and what rushes past is the speed.
  rocket: ROCKET_MS,
  retreat: RETREAT_MS,
  falling: 0,
  over: 0,
} as const satisfies Record<ArcadePhase, number>

// Where along the way the hero runs, per beat, and how. A walk eases out of one crossroad
// and into the next; a retreat and a fall only ease in, so both read as being pulled rather
// than as a move the player made.
const TRAVEL = {
  dawn: null,
  bloom: null,
  open: null,
  walk: { from: 0, to: 1, duration: WALK_MS, easing: Easing.inOut(Easing.cubic) },
  // A strike runs 0 → 2 in two timings rather than one, which is more than an entry here
  // can say — see the effect that drives it.
  rocket: null,
  retreat: { from: 1, to: 0, duration: RETREAT_MS, easing: Easing.in(Easing.cubic) },
  falling: { from: 0, to: 1, duration: FALL_MS, easing: Easing.in(Easing.cubic) },
  over: null,
} as const satisfies Record<
  ArcadePhase,
  { from: number; to: number; duration: number; easing: (t: number) => number } | null
>

// What the clock on the way behind the hero is doing, per beat. It runs while the crossroad
// is open, is cleared the moment the hero answers, and is *held* for as long as it is
// dragging the hero back down — including under the game-over card, where the way that took
// the run is the last thing drawn behind it.
const CREEP = {
  dawn: null,
  bloom: null,
  open: 'running',
  walk: null,
  // Cleared, like a walk: a strike is the clock answered, and answered early.
  rocket: null,
  retreat: 'held',
  falling: 'held',
  over: 'held',
} as const satisfies Record<ArcadePhase, 'running' | 'held' | null>

// A mode switch has no beat of its own, so the sheet takes this long to come round.
const TURN_MS = 620

// SVG ids are global in react-native-svg, and a crossroad id carries dots. One place that
// turns one into the other, so two ways can never share a gradient.
const gradientFor = (id: string): string =>
  `arcade-way-${id.replace(/\./g, '-') || 'first'}`

type StemSpec = {
  key: string
  x: number
  y: number
  spline: Spline
  lit: boolean
  state: StemState
  delay: number
  creepMs: number | 'held' | null
  creepFrom: number
  fade: number
  gradientId: string
}

type BudSpec = {
  key: string
  x: number
  y: number
  value: number
  name: string
  seed: number
  state: BudState
  delay: number
}

export function ArcadeGame({ isDark, onEnd }: { isDark: boolean; onEnd: () => void }) {
  const insets = useSafeAreaInsets()
  const { colorScheme } = useTheme()
  const run = useArcadeRun()
  const [canvas, setCanvas] = useState({ width: 0, height: 0 })

  // One clock for the whole canvas, read on the UI thread by every way's sway and by the
  // hero riding one. A frame callback rather than a repeating animation: the sway periods
  // differ per way, and a looping value would have to wrap somewhere — which every way would
  // show as a kink at the same moment.
  const clock = useSharedValue(0)
  useFrameCallback((frame) => {
    clock.value = frame.timeSinceFirstFrame
  })

  const camX = useSharedValue(0)
  const camY = useSharedValue(0)
  // How far the sheet has been turned. Nought with north pinned to the top of the screen —
  // where it has been until now — and whatever it takes to put the hero's heading up when
  // the player would rather the land turned under them.
  const camTurn = useSharedValue(0)
  const [northUp, setNorthUp] = useState(true)
  const progress = useSharedValue(0)
  const placed = useRef(false)

  const pitch = pitchFor(canvas.height)
  const box = Math.ceil(pitch * STEM_BOX)
  const here = run.standing
  const destination = run.destination
  const driftX =
    destination === undefined ? 0 : canvas.width / 2 - destination.pos.x * pitch
  const driftY =
    destination === undefined ? 0 : canvas.height * ANCHOR - destination.pos.y * pitch

  // The canvas follows whatever the hero is about to be standing on. Driven off the
  // destination rather than off the arrival, so the drift and the walk are one movement —
  // and when the arrival does commit, the camera is already where the new crossroad wants it.
  useEffect(() => {
    if (pitch === 0 || destination === undefined) return
    if (!placed.current) {
      placed.current = true
      camX.value = driftX
      camY.value = driftY
      return
    }
    const duration = DRIFT_MS[run.phase]
    const easing = Easing.inOut(Easing.cubic)
    camX.value = withTiming(driftX, { duration, easing })
    camY.value = withTiming(driftY, { duration, easing })
  }, [driftX, driftY, run.phase, run.seq, pitch])

  // The sheet turns on the same beat the canvas drifts on, so the two are one movement. A
  // mode switch has no beat of its own, so it takes a turn of its own length.
  useEffect(() => {
    const turn = northUp ? 0 : UP - (destination?.heading ?? UP)
    camTurn.value = withTiming(turn, {
      duration: DRIFT_MS[run.phase] || TURN_MS,
      easing: Easing.inOut(Easing.cubic),
    })
  }, [northUp, destination?.heading, run.phase, run.seq])

  useEffect(() => {
    // A strike is one movement with two halves: out of the crossroad under power, then
    // settling into the landing two crossroads on. One `withTiming` cannot say that, and
    // two of them in sequence is exactly what speeding up means.
    if (run.phase === 'rocket') {
      progress.value = 0
      progress.value = withSequence(
        withTiming(1, {
          duration: ROCKET_MS * ROCKET_SPLIT,
          easing: Easing.in(Easing.cubic),
        }),
        withTiming(2, {
          duration: ROCKET_MS * (1 - ROCKET_SPLIT),
          easing: Easing.out(Easing.cubic),
        }),
      )
      return
    }
    const travel = TRAVEL[run.phase]
    // Left where it is on a beat with no travel in it, rather than put back to nought: on
    // those beats the hero is standing on a crossroad and reads no spline at all, and
    // resetting it would snap the fallen hero back up out of the mouth behind the card
    // that has just covered the screen.
    if (travel === null) return
    progress.value = travel.from
    progress.value = withTiming(travel.to, {
      duration: travel.duration,
      easing: travel.easing,
    })
  }, [run.phase, run.seq])

  // Anchor, then turn, then focus. With no turn this is exactly the translation it has
  // always been — `camX`/`camY` already carry the anchor less the focus — so the sheet
  // being able to rotate costs the usual case nothing.
  const camera = useAnimatedStyle(() => ({
    transform: [
      { translateX: camX.value },
      { translateY: camY.value },
      { rotate: `${camTurn.value}rad` },
    ],
  }))

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setCanvas({ width, height })
  }

  // ── What is on the canvas ──
  const stems: StemSpec[] = []
  const buds: BudSpec[] = []
  const stub = pitch > 0 ? mouthStub(pitch) : null
  const leaving = isOneOf(run.phase, ['walk', 'rocket', 'retreat', 'falling', 'over'])
  // Nothing on the canvas while the card is up. Not hidden behind it — not drawn at all:
  // every way grows itself on and every mark of the land fades itself in, and all of that
  // playing out under an opaque card would uncover a map that had already arrived. Held
  // back, the bloom is the reveal.
  const dawn = run.phase === 'dawn'
  const creepPhase = CREEP[run.phase]
  // Held where it is while the run is stopped, which is the whole of what pausing does to
  // the canvas: the red waiting exactly where the player left it.
  const creeping: number | 'held' | null = run.paused
    ? 'held'
    : creepPhase === 'running'
      ? run.clockMs
      : creepPhase
  const nearMouth = here !== undefined && here.depth <= TRAIL_DEPTH
  const mouthFade = here === undefined ? 0 : (FADES[here.depth] ?? 0.2)

  if (!dawn && pitch > 0 && here !== undefined && stub !== null) {
    const herePt = pointsOf(here.pos, pitch)

    // The stub, and the mouth at the foot of it. Always below where the run began, which is
    // the origin of the whole frame — so it is only drawn while it is still near enough to
    // be worth drawing.
    if (nearMouth) {
      stems.push({
        key: 'stub',
        x: 0,
        y: 0,
        spline: stub,
        lit: true,
        state: 'steady',
        // At the first crossroad there is no way behind for the clock to cool, so the stub
        // carries it — and is then what the hero rides down.
        creepMs: here.depth === 0 ? creeping : null,
        creepFrom: run.clockFrom,
        delay: 0,
        fade: mouthFade,
        gradientId: gradientFor('stub'),
      })
    }

    run.behind.forEach((step, i) => {
      const at = pointsOf(step.from.pos, pitch)
      stems.push({
        key: step.way.to,
        x: at.x,
        y: at.y,
        spline: splineFor(step.way, step.from.heading, pitch),
        lit: true,
        state: 'steady',
        // Only the way directly behind the hero carries the clock.
        creepMs: i === 0 ? creeping : null,
        creepFrom: run.clockFrom,
        delay: 0,
        fade: FADES[i] ?? 0.2,
        gradientId: gradientFor(step.way.to),
      })
    })

    here.ways.forEach((way, i) => {
      const spline = splineFor(way, here.heading, pitch)
      const chosen = isOneOf(run.phase, ['walk', 'rocket']) && run.moving?.to === way.to
      stems.push({
        key: way.to,
        x: herePt.x,
        y: herePt.y,
        spline,
        lit: chosen,
        // A chosen way is already drawn and stays: after the arrival commits it is the first
        // way of the trail, under the same key and with the same geometry — so the handover
        // costs not a frame.
        state: chosen ? 'steady' : leaving ? 'withering' : 'growing',
        creepMs: null,
        creepFrom: 0,
        delay: i * STAGGER_MS,
        fade: 1,
        gradientId: gradientFor(way.to),
      })
      buds.push({
        key: way.to,
        x: herePt.x + spline.toX,
        y: herePt.y + spline.toY,
        value: way.value,
        name: run.nameOf(way.to),
        seed: idSeed(way.to),
        state: chosen ? 'absorbing' : leaving ? 'withering' : 'growing',
        delay: i * STAGGER_MS,
      })
    })
  }

  // The way out of the crossroad a strike never stops at, drawn from that crossroad's own
  // place — which is the chosen way's far end, and whose heading is the angle that way
  // arrived on.
  //
  // Added as `growing` rather than already drawn, so it lights up ahead of the rocket
  // instead of appearing under it. After the landing it is the first way of the trail,
  // under the same key and with the same geometry, so that handover costs no frame either.
  const skipped = (() => {
    if (pitch === 0 || here === undefined) return null
    if (run.phase !== 'rocket' || run.moving === null || run.through === null) return null
    const herePt = pointsOf(here.pos, pitch)
    const chosen = splineFor(run.moving, here.heading, pitch)
    return {
      key: run.through.to,
      fromX: herePt.x,
      fromY: herePt.y,
      x: herePt.x + chosen.toX,
      y: herePt.y + chosen.toY,
      spline: splineFor(run.through, run.moving.angle, pitch),
    }
  })()

  if (skipped !== null) {
    stems.push({
      key: skipped.key,
      x: skipped.x,
      y: skipped.y,
      spline: skipped.spline,
      lit: true,
      state: 'growing',
      creepMs: null,
      creepFrom: 0,
      delay: 0,
      fade: 1,
      gradientId: gradientFor(skipped.key),
    })
  }

  // The way the hero is on, in the frame of the crossroad that way leaves — which on a
  // retreat is the one behind it, since a retreat is the way *in*, walked backwards.
  const travelling = (): { spline: Spline | null; x: number; y: number } => {
    if (pitch === 0 || here === undefined) return { spline: null, x: 0, y: 0 }
    const standingAt = pointsOf(here.pos, pitch)
    if (isOneOf(run.phase, ['walk', 'rocket']) && run.moving !== null) {
      return { spline: splineFor(run.moving, here.heading, pitch), ...standingAt }
    }
    if (run.phase === 'retreat' && run.moving !== null && run.parent !== undefined) {
      return {
        spline: splineFor(run.moving, run.parent.heading, pitch),
        ...pointsOf(run.parent.pos, pitch),
      }
    }
    if (isOneOf(run.phase, ['falling', 'over']) && stub !== null) {
      return { spline: stub, ...standingAt }
    }
    return { spline: null, ...standingAt }
  }
  const hero = travelling()

  // What the land is, where the hero is standing. A pure function of the world and the run's
  // seed — see hooks/use-arcade-land.ts for why the answers are kept.
  const land = useArcadeLand({
    seed: run.seed,
    pitch,
    canvas,
    origin: here?.pos ?? { x: 0, y: 0 },
    sight: run.sight,
  })

  const sum = computeSum(run.grid)
  const direction = useScoreDirection(sum)
  const arcadeInk = ARCADE_INK[colorScheme]
  const ink = MAP_INK[colorScheme]
  // What every mark on the map fills itself with before it is inked: the theme's own ground,
  // so the knockout is invisible except where it covers something.
  const surface = SURFACE[colorScheme]

  return (
    <ScreenLayer>
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {/* ── Top bar ── */}
        <View className="flex-row items-center px-4 py-2">
          <View className="flex-1">
            <Text
              selectable={false}
              className="font-mono text-[13px] font-black tracking-[2px]"
              style={{ color: arcadeInk }}
            >
              <Trans>ARCADE</Trans>
            </Text>
            {/* Where the hero is standing, by name. The depth is the score and it is on the
                pause screen and the end of the run; what a player wants to read mid-run is
                the place they are in — and every crossroad has had a name since the map
                started drawing itself one. Clipped rather than wrapped: a second line here
                would push the whole row down. */}
            <Text
              selectable={false}
              numberOfLines={1}
              className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
            >
              {here?.name.toUpperCase() ?? ''}
            </Text>
          </View>
          <View className="items-center">
            {/* The game's name, the one string that is the same in every language. The left
              padding answers the tracking the last letter carries. */}
            <Text
              selectable={false}
              className="pl-[8px] font-mono text-[24px] font-black tracking-[8px]"
              style={{ color: arcadeInk }}
            >
              NINE
            </Text>
          </View>
          {/* The way out, the same one every run has — and only while the hero is
              standing on a crossroad. Mid-flight there is no beat to stop: a movement is
              a second at most, and a screen that froze halfway along a way would have to
              be resumed into an animation that had already finished without it. The
              column keeps its width either way, so nothing else in the row moves. */}
          <View className="flex-1 items-end">
            {run.dialable && (
              <Animated.View
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(160)}
              >
                <PauseButton color={arcadeInk} onPress={run.pause} />
              </Animated.View>
            )}
          </View>
        </View>

        {/* ── The way ── */}
        {/* Clipped, because the map runs well past what is worth looking at: the canvas is a
          window onto the climb rather than the whole of it. */}
        <View className="flex-1 overflow-hidden" onLayout={onCanvasLayout}>
          {/* The sheet. Mounted when the card leaves, and fading up over exactly as long as
            the card takes to go, so the two are one handover rather than a swap. */}
          {!dawn && (
            <Animated.View
              entering={FadeIn.duration(DAWN_OUT_MS)}
              style={[
                { position: 'absolute', left: 0, top: 0, width: 1, height: 1 },
                camera,
              ]}
            >
              {/* The country, under the ways and over nothing. Each feature is its own small
                SVG so it can arrive on its own and leave once the hero has walked far
                enough that nobody is looking at it. */}
              {land.map((feature) => (
                <LandMark
                  key={feature.key}
                  feature={feature}
                  pitch={pitch}
                  line={ink.line}
                  hatch={ink.hatch}
                  knockout={surface}
                />
              ))}
              {stems.map((stem) => (
                <WayStem
                  key={stem.key}
                  x={stem.x}
                  y={stem.y}
                  box={box}
                  spline={stem.spline}
                  lit={stem.lit}
                  state={stem.state}
                  delay={stem.delay}
                  clock={clock}
                  creepMs={stem.creepMs}
                  creepFrom={stem.creepFrom}
                  fade={stem.fade}
                  gradientId={stem.gradientId}
                  aheadInk={ink.line}
                  amber={AMBER}
                  ember={EMBER}
                />
              ))}
              {stub !== null && nearMouth && (
                <ArcadeMouth
                  x={stub.toX}
                  y={stub.toY}
                  fade={mouthFade}
                  ring={ink.hatch}
                  ember={EMBER}
                />
              )}
              {buds.map((bud) => (
                <WayBud
                  key={bud.key}
                  x={bud.x}
                  y={bud.y}
                  value={bud.value}
                  name={bud.name}
                  seed={bud.seed}
                  state={bud.state}
                  delay={bud.delay}
                  edge={BUD_EDGE}
                  ink={PIE_INK[colorScheme]}
                  turn={camTurn}
                  line={ink.line}
                  hatch={ink.hatch}
                  face={surface}
                />
              ))}
              {skipped !== null && (
                <ArcadeStrike
                  // Keyed on the beat, so each strike is its own word rather than one view
                  // restarting — two in a row would otherwise share an animation.
                  key={run.seq}
                  x={skipped.fromX}
                  y={skipped.fromY}
                  turn={camTurn}
                  ink={arcadeInk}
                />
              )}
              {/* The name of the place just reached, under the flame. Keyed on the crossroad,
                so arriving plays it once and walking on plays the next one rather than
                restarting this one. */}
              {here !== undefined && pitch > 0 && (
                <VillageArrival
                  key={here.id}
                  x={pointsOf(here.pos, pitch).x}
                  y={pointsOf(here.pos, pitch).y}
                  name={here.name}
                  turn={camTurn}
                  ink={arcadeInk}
                />
              )}
              <ArcadeHero
                originX={hero.x}
                originY={hero.y}
                spline={hero.spline}
                through={skipped?.spline ?? null}
                throughX={skipped?.x ?? 0}
                throughY={skipped?.y ?? 0}
                progress={progress}
                clock={clock}
                turn={camTurn}
                standing={!leaving}
                rocketing={run.phase === 'rocket'}
                amber={AMBER}
                core={HERO_CORE}
              />
            </Animated.View>
          )}

          {/* Over the sheet rather than on it: the rose is a control and a reading, and
              neither belongs to the part that turns. Left mounted under the card rather
              than arriving with the sheet: a control that popped in after the words would
              be one more thing moving at the one moment the map is asking to be read. */}
          <CompassRose
            turn={camTurn}
            northUp={northUp}
            line={ink.line}
            hatch={ink.hatch}
            knockout={surface}
            onToggle={() => {
              setNorthUp((was) => !was)
            }}
          />

          {/* The words the run opens on, over the canvas and nothing else: the dial stays
              where it is, dimmed, so the first thing a player sees of arcade is the place
              being set out rather than a board already dealt. */}
          {dawn && <ArcadeDawn ink={arcadeInk} />}
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
                  isDark={isDark}
                  progress={valueProgress(sum)}
                />
              ))}
          </View>
        </View>

        {/* ── Dial ── */}
        {/* Every key shut while the hero is moving: the answer has been given, and a key
          pressed mid-walk would be answering a crossroad nobody is standing on. */}
        <Dial
          values={run.grid.flat()}
          isDark={isDark}
          showSum={false}
          trainee={false}
          controls={run.dialable ? undefined : ALL_OFF}
          peakFrom={DARK_MODE_GRADIENT.arcade[0]}
          peakTo={DARK_MODE_GRADIENT.arcade[1]}
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
            playedMs={run.playedMs}
            onContinue={run.resume}
            onEnd={onEnd}
          />
        )}

        {run.phase === 'over' && (
          <ArcadeOver
            depth={run.best}
            strikes={run.strikes}
            playedMs={run.playedMs}
            onAgain={run.restart}
            onHome={onEnd}
          />
        )}
      </View>
    </ScreenLayer>
  )
}
