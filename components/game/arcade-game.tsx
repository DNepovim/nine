import { Trans } from '@lingui/react/macro'
import { isOneOf } from 'narrowland'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ArcadeHero } from '@/components/game/arcade-hero'
import { ArcadeMouth } from '@/components/game/arcade-mouth'
import { ArcadeOver } from '@/components/game/arcade-over'
import { Dial } from '@/components/game/dial'
import { ScoreDigit } from '@/components/game/score-digit'
import { WayBud, type BudState } from '@/components/game/way-bud'
import { WayStem, type StemState } from '@/components/game/way-stem'
import { ScreenLayer } from '@/components/screen'
import {
  ANCHOR,
  FALL_MS,
  RETREAT_MS,
  STAGGER_MS,
  STEM_BOX,
  TRAIL_DEPTH,
  WALK_MS,
} from '@/constants/arcade'
import { ARCADE_INK, PIE_INK, WAY_INK } from '@/constants/colors'
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
import { computeSum, DARK_MODE_GRADIENT, lerpColor, MODE_GRADIENT } from '@/machines/game'
import type { Difficulty } from '@/machines/modes'
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
  bloom: 0,
  open: 0,
  walk: WALK_MS,
  retreat: RETREAT_MS,
  falling: 0,
  over: 0,
} as const satisfies Record<ArcadePhase, number>

// Where along the way the hero runs, per beat, and how. A walk eases out of one crossroad
// and into the next; a retreat and a fall only ease in, so both read as being pulled rather
// than as a move the player made.
const TRAVEL = {
  bloom: null,
  open: null,
  walk: { from: 0, to: 1, duration: WALK_MS, easing: Easing.inOut(Easing.cubic) },
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
  bloom: null,
  open: 'running',
  walk: null,
  retreat: 'held',
  falling: 'held',
  over: 'held',
} as const satisfies Record<ArcadePhase, 'running' | 'held' | null>

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
  fade: number
  gradientId: string
}

type BudSpec = {
  key: string
  x: number
  y: number
  value: number
  state: BudState
  delay: number
}

export function ArcadeGame({
  difficulty,
  isDark,
  onEnd,
}: {
  difficulty: Difficulty
  isDark: boolean
  onEnd: () => void
}) {
  const insets = useSafeAreaInsets()
  const { colorScheme } = useTheme()
  const run = useArcadeRun(difficulty)
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

  useEffect(() => {
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

  const camera = useAnimatedStyle(() => ({
    transform: [{ translateX: camX.value }, { translateY: camY.value }],
  }))

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setCanvas({ width, height })
  }

  // ── What is on the canvas ──
  const stems: StemSpec[] = []
  const buds: BudSpec[] = []
  const stub = pitch > 0 ? mouthStub(pitch) : null
  const leaving = isOneOf(run.phase, ['walk', 'retreat', 'falling', 'over'])
  const creepPhase = CREEP[run.phase]
  const creeping: number | 'held' | null =
    creepPhase === 'running' ? run.clockMs : creepPhase
  const nearMouth = here !== undefined && here.depth <= TRAIL_DEPTH
  const mouthFade = here === undefined ? 0 : (FADES[here.depth] ?? 0.2)

  if (pitch > 0 && here !== undefined && stub !== null) {
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
        delay: 0,
        fade: FADES[i] ?? 0.2,
        gradientId: gradientFor(step.way.to),
      })
    })

    here.ways.forEach((way, i) => {
      const spline = splineFor(way, here.heading, pitch)
      const chosen = run.phase === 'walk' && run.moving?.to === way.to
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
        delay: i * STAGGER_MS,
        fade: 1,
        gradientId: gradientFor(way.to),
      })
      buds.push({
        key: way.to,
        x: herePt.x + spline.toX,
        y: herePt.y + spline.toY,
        value: way.value,
        state: chosen ? 'absorbing' : leaving ? 'withering' : 'growing',
        delay: i * STAGGER_MS,
      })
    })
  }

  // The way the hero is on, in the frame of the crossroad that way leaves — which on a
  // retreat is the one behind it, since a retreat is the way *in*, walked backwards.
  const travelling = (): { spline: Spline | null; x: number; y: number } => {
    if (pitch === 0 || here === undefined) return { spline: null, x: 0, y: 0 }
    const standingAt = pointsOf(here.pos, pitch)
    if (run.phase === 'walk' && run.moving !== null) {
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

  const sum = computeSum(run.grid)
  const direction = useScoreDirection(sum)
  const arcadeInk = ARCADE_INK[colorScheme]

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
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
            >
              <Trans>DEPTH</Trans> {run.depth}
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
          <View className="flex-1 items-end">
            <Pressable onPress={onEnd} hitSlop={12}>
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[2px] text-dim"
              >
                <Trans>END</Trans>
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── The way ── */}
        {/* Clipped, because the map runs well past what is worth looking at: the canvas is a
          window onto the climb rather than the whole of it. */}
        <View className="flex-1 overflow-hidden" onLayout={onCanvasLayout}>
          <Animated.View
            style={[
              { position: 'absolute', left: 0, top: 0, width: 1, height: 1 },
              camera,
            ]}
          >
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
                fade={stem.fade}
                gradientId={stem.gradientId}
                aheadInk={WAY_INK[colorScheme]}
                amber={AMBER}
                ember={EMBER}
              />
            ))}
            {stub !== null && nearMouth && (
              <ArcadeMouth
                x={stub.toX}
                y={stub.toY}
                fade={mouthFade}
                ring={WAY_INK[colorScheme]}
                ember={EMBER}
              />
            )}
            {buds.map((bud) => (
              <WayBud
                key={bud.key}
                x={bud.x}
                y={bud.y}
                value={bud.value}
                state={bud.state}
                delay={bud.delay}
                edge={BUD_EDGE}
                ink={PIE_INK[colorScheme]}
              />
            ))}
            <ArcadeHero
              originX={hero.x}
              originY={hero.y}
              spline={hero.spline}
              progress={progress}
              clock={clock}
              standing={!leaving}
              amber={AMBER}
              core={HERO_CORE}
            />
          </Animated.View>
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

        {run.phase === 'over' && (
          <ArcadeOver depth={run.best} onAgain={run.restart} onHome={onEnd} />
        )}
      </View>
    </ScreenLayer>
  )
}
