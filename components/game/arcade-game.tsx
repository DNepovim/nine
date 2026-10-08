import { Trans } from '@lingui/react/macro'
import { isOneOf } from 'narrowland'
import { useEffect, useRef, useState } from 'react'
import { Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useDerivedValue,
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
import { HeartIcon } from '@/components/game/heart-icon'
import { LandMark } from '@/components/game/land-mark'
import { RunTopBar } from '@/components/game/run-top-bar'
import { SatietyBar } from '@/components/game/satiety-bar'
import { ScoreDigit } from '@/components/game/score-digit'
import { SiegeField } from '@/components/game/siege-field'
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
import { CLOSE_MS, HEARTS, OPEN_MS, SIEGE_ZOOM, TAKEN_MS } from '@/constants/siege'
import { TYPE } from '@/constants/typography'
import { useArcadeLand } from '@/hooks/use-arcade-land'
import { useArcadeRun, type ArcadePhase } from '@/hooks/use-arcade-run'
import { SUM_ROW_HEIGHT } from '@/hooks/use-dial-metrics'
import { usePersistedRose } from '@/hooks/use-persisted-rose'
import { useScoreDirection } from '@/hooks/use-score-direction'
import {
  mouthStub,
  pitchFor,
  pointsOf,
  siegeFrame,
  splineFor,
  splinePoint,
  type Spline,
} from '@/lib/arcade-layout'
import { horizonOf, type Sheet } from '@/lib/arcade-tilt'
import { cn } from '@/lib/cn'
import { valueProgress } from '@/lib/value-progress'
import { ARCADE_DIAL, idSeed, UP } from '@/machines/arcade'
import type { DialControl } from '@/machines/tutorial-lesson'
import { cellsOf, darkGradientOf, gradientOf, lerpColor, sumOf } from '@/modes'

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

const [EMBER, AMBER] = gradientOf('arcade')
const HERO_CORE = lerpColor(AMBER, '#FFFFFF', 0.62)

// The amber at a little under half, which is as much edge as a bud can take before the ring
// starts competing with the numeral inside it.
const BUD_EDGE = `${AMBER}73`

// How much of the sheet a village's name needs to itself before a neighbour's would cross
// it. The label is a serif at 9pt and at most thirteen characters, which comes to about this.
const NAME_ROOM = 74

// How far back the hero's own history stays legible. The way it is standing on is at full
// strength; what is behind that is there to say where the run came from.
const FADES = [1, 0.45, 0.2] as const

const ALL_OFF: readonly DialControl[] = cellsOf(ARCADE_DIAL).map(() => 'off')

// The beats the hero spends at a walled village's gate — which is every beat of a siege,
// including the two that end one: the walls come down, or the run is overrun, from the same
// place it fought from. `over` is in it for that second ending, because a run that died in a
// siege died there and the card goes up over the ground it died on. A run that ended any
// other way never matches: there is no way in for it to be drawn on. See `travelling`.
const AT_THE_GATE: readonly ArcadePhase[] = [
  'closing',
  'siege',
  'taken',
  'overrun',
  'over',
]

// The beats the camera is in close for, which is those four less `taken`: the walls coming
// down is the camera letting go, and it opens out while the hero is still walking in — so
// the fan the village blooms into arrives on a sheet already back at rest.
const CAMERA_IN: readonly ArcadePhase[] = ['closing', 'siege', 'overrun']

// What the country and the ways fade to while a siege is on. Not hidden — the run has to
// stay somewhere on the map, and a player who breaks off has to see where the way back is —
// but out of the way of a screen that has just become busy.
const COUNTRY_AWAY = 0.25

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
  // A siege moves the camera *in* rather than across: the hero is at the gate for all four
  // of these beats — stopped outside it for three, and walking the last of the way in on
  // `taken`, which the anchor is already sitting on — so there is no ground for the canvas
  // to cover.
  closing: 0,
  siege: 0,
  taken: 0,
  overrun: 0,
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
  // The hero holds at the stand-off for the fight itself, so neither of those two moves it
  // along the way. `closing` does set it once — not to move the hero but to re-number where
  // it already is, the way in being drawn from the crossroad behind from that beat on. See
  // the effect that drives it.
  closing: null,
  siege: null,
  // The walls are down, and this is the hero crossing the ground it spent the fight standing
  // on and walking in through the gate, on the same spline it has been held on, ending
  // exactly where the village stands. It is what the beat is this long for — and it is what
  // makes the handover into `bloom` cost no frame, the fan growing around a hero that is
  // already standing in the middle of it.
  //
  // The one beat with no `from`. Where it starts is the stand-off, which is not a constant
  // any more but whatever the fight was framed at — so it walks on from wherever it was
  // standing rather than from a figure written down here. See `siegeFrame`.
  taken: { from: null, to: 1, duration: TAKEN_MS, easing: Easing.inOut(Easing.cubic) },
  overrun: null,
  over: null,
} as const satisfies Record<
  ArcadePhase,
  {
    from: number | null
    to: number
    duration: number
    easing: (t: number) => number
  } | null
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
  // A siege has no crossroad clock — what is counting down is the gate, not the way in —
  // so the way behind stays clear for all four.
  closing: null,
  siege: null,
  taken: null,
  overrun: null,
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
  named: boolean
  seed: number
  state: BudState
  delay: number
  // Whether this village has walls worth the name. The one thing about a way that is worth
  // knowing *before* dialling it, which is the whole reason it is drawn rather than
  // discovered.
  fortified: boolean
  // When this village gives up, and how long it had. Null on every bud that is not a live
  // way out of where the hero stands — the trail behind, and the crossroad a strike is
  // about to pass through, are places rather than offers and have no clock to run.
  endsAt: number | null
  clockMs: number
}

export function ArcadeGame({ onEnd }: { onEnd: () => void }) {
  const insets = useSafeAreaInsets()
  const run = useArcadeRun()
  const [canvas, setCanvas] = useState({ width: 0, height: 0 })

  // One clock for the whole canvas, read on the UI thread by every way's sway and by the
  // hero riding one. A frame callback rather than a repeating animation: the sway periods
  // differ per way, and a looping value would have to wrap somewhere — which every way would
  // show as a kink at the same moment.
  const clock = useSharedValue(0)
  // The same frame, in wall-clock. Read by the siege, which is the one thing on this sheet
  // measured against a clock React also holds: a warrior's `spawnedAt` is a `Date.now()`
  // and a pause moves it by a `Date.now()` difference — see `shift` in machines/siege.
  //
  // Sampled here rather than rebasing the frame clock onto wall-clock once, which is what
  // this used to do. `timeSinceFirstFrame` is a difference of *platform frame* timestamps
  // — `CACurrentMediaTime()` on iOS, Choreographer's `System.nanoTime()` on Android — and
  // neither of those advances while the device sleeps, while `Date.now()` does. One screen
  // lock and a fixed rebase is out by however long the phone was in a pocket, for the rest
  // of the run: every warrior would draw at `t = 0`, parked invisible on the gate, while
  // the hook went on collecting them on time. Taking both readings off the same frame
  // cannot drift, because there is nothing left to drift.
  const now = useSharedValue(Date.now())
  useFrameCallback((frame) => {
    clock.value = frame.timeSinceFirstFrame
    now.value = Date.now()
  })

  const camX = useSharedValue(0)
  const camY = useSharedValue(0)
  // How far in the camera has come. One for the whole canvas, on the same view the pan is
  // on, so the country, the ways and the village scale together — a siege is the same sheet
  // looked at closer, not a second screen.
  const camScale = useSharedValue(1)
  // How far up the whole sheet has been carried, in screen points. Nought everywhere but a
  // siege, where it is what lifts the walls to the top of the canvas and leaves the rest of
  // it to the fight. On the sheet's own view rather than folded into the focus, because it
  // is a measure of the *screen* and the focus is a measure of the map — a lift under the
  // zoom would come out two and a half times what it was asked for.
  const camLift = useSharedValue(0)
  // How much of the country is left while that is on. See COUNTRY_AWAY.
  const away = useSharedValue(1)
  // How far the sheet has been turned. Nought with north pinned to the top of the screen —
  // where it has been until now — and whatever it takes to put the hero's heading up when
  // the player would rather the land turned under them.
  const camTurn = useSharedValue(0)
  // How much of the tilt is on: the sheet lying away from the reader at one, flat on at
  // nought. One everywhere but a siege, which is a view of its own — see lib/arcade-tilt.ts.
  const camTilt = useSharedValue(1)
  // Which way up the player reads this map, as they last left it: ahead at the top until they
  // say otherwise. Persisted rather than held here, because the screen goes with the run.
  const { northUp, setNorthUp } = usePersistedRose()
  const progress = useSharedValue(0)
  const placed = useRef(false)

  const pitch = pitchFor(canvas.height)
  const box = Math.ceil(pitch * STEM_BOX)
  const here = run.standing
  const destination = run.destination
  // Where the sheet has to stand for the destination to land on the anchor. The *focus*
  // only — the anchor itself is a fixed point of the canvas and belongs to the view that
  // pivots about it, not to the value that animates.
  const driftX = destination === undefined ? 0 : -destination.pos.x * pitch
  const driftY = destination === undefined ? 0 : -destination.pos.y * pitch
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
  const frame = siegeFrame(canvas.height, wayIn?.reach ?? 1)

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

  // In on the walls, and out again when they are down — with the country stepping back under
  // it. One effect for the two because they are one movement: a zoom that arrived before the
  // sheet behind it had dimmed would read as two things the screen did rather than as the
  // camera picking a fight out of the map.
  useEffect(() => {
    const closing = isOneOf(run.phase, CAMERA_IN)
    const duration = closing ? CLOSE_MS : OPEN_MS
    const easing = Easing.inOut(Easing.cubic)
    camScale.value = withTiming(closing ? SIEGE_ZOOM : 1, { duration, easing })
    camLift.value = withTiming(closing ? frame.lift : 0, { duration, easing })
    away.value = withTiming(closing ? COUNTRY_AWAY : 1, { duration, easing })
    // And the sheet comes down to level with it. A fight is the one thing on this screen
    // already drawn in a perspective of its own — a wall across the top of the canvas and
    // the ground in front of it — so the map's own tilt steps out of its way, on the same
    // beat as the zoom, rather than leaving the field lying at two angles at once.
    camTilt.value = withTiming(closing ? 0 : 1, { duration, easing })
  }, [run.phase, frame.lift])

  // The sheet turns on the same beat the canvas drifts on, so the two are one movement. A
  // mode switch has no beat of its own, so it takes a turn of its own length.
  //
  // A walled village is the one place the player's rose does not get the last word. A siege
  // is a wall across the top of the canvas with the ground in front of it below — that is
  // the whole picture — and a sheet pinned to north would hang that wall off at whatever
  // angle the way in happened to leave on, with the field running into a corner and the
  // towers standing at odds with the wall they are built into. So the camera squares up to
  // the walls as it closes on them, from the walk in, and the sheet goes back to the reading
  // the player asked for once the village is taken.
  useEffect(() => {
    const squared = destination?.fortified === true
    const turn = northUp && !squared ? 0 : UP - (destination?.heading ?? UP)
    camTurn.value = withTiming(turn, {
      duration: DRIFT_MS[run.phase] || (squared ? CLOSE_MS : TURN_MS),
      easing: Easing.inOut(Easing.cubic),
    })
  }, [northUp, destination?.heading, destination?.fortified, run.phase, run.seq])

  useEffect(() => {
    // How far along the last way of this movement the hero gets. All of it normally; well
    // short of the gate when what is standing at the end has walls, which is what leaves the
    // walls at the top of the canvas and the whole of the ground under them for the warriors
    // to cross.
    const stop = run.destination?.fortified === true ? frame.standoff : 1
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
        withTiming(1 + stop, {
          duration: ROCKET_MS * (1 - ROCKET_SPLIT),
          easing: Easing.out(Easing.cubic),
        }),
      )
      return
    }
    // The one walk TRAVEL cannot say: the same curve over the same time, stopped short of
    // the end. Nothing else about it differs from an ordinary walk, which is why it is a
    // branch here rather than a second entry there.
    if (run.phase === 'walk' && stop < 1) {
      progress.value = 0
      progress.value = withTiming(stop, {
        duration: WALK_MS,
        easing: Easing.inOut(Easing.cubic),
      })
      return
    }
    // The one beat that sets this without moving anything. From here on the hero is drawn
    // on the way *in*, in the frame of the crossroad behind — one spline where a strike had
    // two — and the point it is already standing on is the stand-off in that frame. Same
    // point on the sheet, so the handover costs not a frame.
    if (run.phase === 'closing') {
      progress.value = frame.standoff
      return
    }
    const travel = TRAVEL[run.phase]
    // Left where it is on a beat with no travel in it, rather than put back to nought: on
    // those beats the hero is standing on a crossroad and reads no spline at all, and
    // resetting it would snap the fallen hero back up out of the mouth behind the card
    // that has just covered the screen.
    if (travel === null) return
    // And left where it is on a beat that names no `from`, which is the walk in through a
    // gate: it starts from wherever the fight was fought from.
    if (travel.from !== null) progress.value = travel.from
    progress.value = withTiming(travel.to, {
      duration: travel.duration,
      easing: travel.easing,
    })
  }, [run.phase, run.seq, frame.standoff])

  // The sheet is two views, and it has to be.
  //
  // A transform in React Native turns about the *centre of its own view* — there is no
  // transform origin to set. So the turn and the pan cannot live on one view: putting both
  // on the view the world is laid out in pivots the sheet about the point the run began at,
  // which for a hero ten crossroads up swings it clean off the screen.
  //
  // So the turn goes on a view with no size, positioned exactly at the anchor: its centre
  // *is* the anchor, so that is what it turns about. The pan goes on the view inside it,
  // which carries the world. Anchor, then turn, then focus — and with no turn it is the
  // same translation it always was.
  // The lift sits *before* the turn in the list, so it is the last thing applied to a point
  // and so lands in screen points: the sheet is raised straight up the canvas whatever angle
  // it happens to be lying at. Behind the turn it would have been carried round with it.
  const sheetTurn = useAnimatedStyle(() => ({
    transform: [{ translateY: camLift.value }, { rotate: `${camTurn.value}rad` }],
  }))
  const sheetPan = useAnimatedStyle(() => ({
    // The scale comes *first* in the list and that is not a style choice. A transform array
    // composes left to right as matrices, so the last entry is the one applied to a point
    // first: `[scale, translateX, translateY]` maps a point to `scale * (point + cam)`,
    // which is the pan happening under the zoom and so the anchor — where the focus always
    // puts the destination — holding still. The other order zooms about the crossroad the
    // run began on, and ten crossroads up that throws the whole sheet off the screen.
    transform: [
      { scale: camScale.value },
      { translateX: camX.value },
      { translateY: camY.value },
    ],
  }))
  const country = useAnimatedStyle(() => ({ opacity: away.value }))

  // The camera as one value, which is what every mark on the sheet reads to know where it is
  // drawn and at what size. Derived rather than five props: the pan, the zoom, the turn and
  // the tilt are animated apart from each other, and the projection needs all four at once.
  const sheet = useDerivedValue<Sheet>(() => ({
    x: camX.value,
    y: camY.value,
    turn: camTurn.value,
    scale: camScale.value,
    tilt: camTilt.value,
    horizon: horizonOf(canvas.height),
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
        // A name needs about this much of the sheet to itself. Two towns on one fan can
        // stand closer than that, and the later one gives its name up — which it can
        // afford to, because arriving there names it under the flame anyway.
        named: buds.every(
          (other) => Math.abs(other.x - (herePt.x + spline.toX)) > NAME_ROOM,
        ),
        seed: idSeed(way.to),
        // A village that has run out of patience withers exactly as a refused one does —
        // it is the same thing happening for a different reason, and the fan should not
        // grow a second way of saying a town is gone.
        state: chosen
          ? 'absorbing'
          : leaving || run.expired.includes(way.to)
            ? 'withering'
            : 'growing',
        delay: i * STAGGER_MS,
        fortified: run.walledAt(way.to),
        endsAt: run.expiresAt[way.to] ?? null,
        clockMs: way.clockMs,
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
    // Under the walls, the hero is not standing on the crossroad it has arrived at — it is
    // stopped short of its gate, on the last of the way in. So it is drawn on that way,
    // from the crossroad behind, which is the same curve and the same frame the walk that
    // brought it here was riding.
    //
    // This comes before the mouth below because the two deaths a run can end on are not the
    // same picture, and `over` is both of them. A hero overrun at a walled village died
    // where it fought and stays at the gate under the card. A hero that fell died down the
    // stub, in the mouth. What tells them apart is the one fact that chose the death in the
    // first place: `falling` is only ever reached from a crossroad with nothing behind it —
    // that is *why* there is a mouth under it and not a way to retreat down — so a dead hero
    // with a way in to stand on was overrun, and one without it fell. The guard below is
    // already exactly that question, so the mouth needs no second test and keeps every frame
    // it had.
    if (isOneOf(run.phase, AT_THE_GATE) && run.parent !== undefined) {
      const parent = run.parent
      const wayIn = parent.ways.find((way) => way.to === here.id)
      if (wayIn !== undefined) {
        return {
          spline: splineFor(wayIn, parent.heading, pitch),
          ...pointsOf(parent.pos, pitch),
        }
      }
    }
    if (isOneOf(run.phase, ['falling', 'over']) && stub !== null) {
      return { spline: stub, ...standingAt }
    }
    return { spline: null, ...standingAt }
  }
  const hero = travelling()
  // Where the hero is *drawn*. `hero.x/.y` is the crossroad the way it is on leaves, which
  // is a frame rather than a place — and the warriors have to walk at the hero itself.
  // Read at the stand-off, which is where it holds for the whole of a fight, and read
  // without the sway — the way's breath moves this point by a couple of points out of the
  // hundred and thirty it stands from the crossroad behind, and reading it off the clock
  // would mean carrying the spline into the warriors' own worklet for that.
  const stand =
    hero.spline === null ? { x: 0, y: 0 } : splinePoint(hero.spline, frame.standoff, 0)

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
            title={<Trans>ARCADE</Trans>}
            subtitle={here?.name.toUpperCase() ?? ''}
            wordmark={ARCADE_INK}
            onPause={run.dialable ? run.pause : null}
          />
          {/* The hearts, in the row the game screen keeps them in and drawn by the same
              component. Nothing on the way itself can take one — a strike costs a
              crossroad, not a life — so for most of a run these sit full and say only
              that there is something here to lose. The first warrior through makes them
              the thing being watched.

              Counted off `HEARTS` rather than written out, which the game screen is free
              to do because its own count can be infinite and a literal there is a
              deliberate ceiling. Here there is one tuning constant and a bar that would
              quietly stop matching the run if it were changed. */}
          {/* And the bar, in the same row at the other end of it: the hearts on the left
              under ARCADE, how fed the hero is on the right under the way out. The two
              belong in one row because they are one reading — the hearts are what is left
              to lose, and the bar is how long before losing them starts — but the bar is
              short and tucked under the pause button rather than stretched between them.
              A rule running the width of the screen reads as a loading bar, and this one
              is a gauge. */}
          <View className="mt-1.5 flex-row items-end justify-between">
            <View className="flex-row gap-1">
              {Array.from({ length: HEARTS }, (_, i) => (
                <HeartIcon key={i} filled={i < run.hearts} emptyColor={'#FDFCFA'} />
              ))}
            </View>
            {/* About as wide as the MENU button above it, so the two read as one column
                down the right-hand edge, with the bar named over it.

                The hearts opposite carry no label and want none — three hearts are three
                hearts in every game ever made. A draining bar is not that: it could be a
                clock, a charge or a score until something says otherwise, and the one
                place a player looks to find out is directly above it. */}
            <View className="w-16 items-end gap-1">
              <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
                <Trans>SATIETY</Trans>
              </Text>
              <SatietyBar satiety={run.satiety} starving={run.starving} />
            </View>
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
              // No size, and sitting on the anchor: a view's transform turns about its own
              // centre, so this is the one place the sheet can be turned from.
              style={[
                {
                  position: 'absolute',
                  left: anchorX,
                  top: anchorY,
                  width: 0,
                  height: 0,
                },
                sheetTurn,
              ]}
            >
              <Animated.View
                style={[{ position: 'absolute', left: 0, top: 0 }, sheetPan]}
              >
                {/* The map the run is climbing: the country, the ways out of here, the
                ways behind and the villages at their ends. All of it one group, because
                all of it steps back together while a siege is on — what is left at full
                strength is the hero and the village it is standing under, which is the
                whole of what there is to look at by then. */}
                <Animated.View className="absolute left-0 top-0" style={country}>
                  {/* The country, under the ways and over nothing. Each feature is its
                  own small SVG so it can arrive on its own and leave once the hero has
                  walked far enough that nobody is looking at it. */}
                  {land.map((feature) => (
                    <LandMark
                      key={feature.key}
                      feature={feature}
                      pitch={pitch}
                      sheet={sheet}
                      line={MAP_INK.line}
                      hatch={MAP_INK.hatch}
                      knockout={SURFACE}
                    />
                  ))}
                  {stems.map((stem) => (
                    <WayStem
                      key={stem.key}
                      x={stem.x}
                      y={stem.y}
                      box={box}
                      spline={stem.spline}
                      sheet={sheet}
                      lit={stem.lit}
                      state={stem.state}
                      delay={stem.delay}
                      clock={clock}
                      creepMs={stem.creepMs}
                      creepFrom={stem.creepFrom}
                      fade={stem.fade}
                      gradientId={stem.gradientId}
                      aheadInk={MAP_INK.line}
                      amber={AMBER}
                      ember={EMBER}
                    />
                  ))}
                  {stub !== null && nearMouth && (
                    <ArcadeMouth
                      x={stub.toX}
                      y={stub.toY}
                      sheet={sheet}
                      fade={mouthFade}
                      ring={MAP_INK.hatch}
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
                      named={bud.named}
                      seed={bud.seed}
                      state={bud.state}
                      delay={bud.delay}
                      fortified={bud.fortified}
                      endsAt={bud.endsAt}
                      clockMs={bud.clockMs}
                      now={now}
                      edge={BUD_EDGE}
                      ink={PIE_INK}
                      sheet={sheet}
                      line={MAP_INK.line}
                      hatch={MAP_INK.hatch}
                      face={SURFACE}
                    />
                  ))}
                </Animated.View>
                {skipped !== null && (
                  <ArcadeStrike
                    // Keyed on the beat, so each strike is its own word rather than one view
                    // restarting — two in a row would otherwise share an animation.
                    key={run.seq}
                    x={skipped.fromX}
                    y={skipped.fromY}
                    sheet={sheet}
                    ink={ARCADE_INK}
                  />
                )}
                {/* The fight, over the ground it is fought on. Outside the group above,
                like the hero and the strike: the country steps back while a siege is on and
                the besieged village is the one thing left to look at. */}
                {run.siege !== null && here !== undefined && pitch > 0 && (
                  <SiegeField
                    siege={run.siege}
                    now={now}
                    turn={camTurn}
                    villageX={pointsOf(here.pos, pitch).x}
                    villageY={pointsOf(here.pos, pitch).y}
                    heroX={hero.x + stand.x}
                    heroY={hero.y + stand.y}
                    width={canvas.width}
                    ink={PIE_INK}
                    line={MAP_INK.line}
                    hatch={MAP_INK.hatch}
                    // The one red on this screen, which is arcade's own first stop. A
                    // siege does not get a second — see the design guide.
                    blood={EMBER}
                    face={SURFACE}
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
                    sheet={sheet}
                    ink={ARCADE_INK}
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
                  sheet={sheet}
                  pitch={pitch}
                  standing={!leaving}
                  rocketing={run.phase === 'rocket'}
                  amber={AMBER}
                  ember={EMBER}
                  core={HERO_CORE}
                  smoke={MAP_INK.hatch}
                />
              </Animated.View>
            </Animated.View>
          )}

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
