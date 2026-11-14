import { isOneOf } from 'narrowland'
import { useEffect, useRef } from 'react'
import {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { CLEARED_MS } from '@/constants/ambush'
import { FALL_MS, RETREAT_MS, ROCKET_MS, ROCKET_SPLIT, WALK_MS } from '@/constants/arcade'
import { CLOSE_MS, OPEN_MS, SIEGE_ZOOM, TAKEN_MS } from '@/constants/siege'
import type { ArcadePhase, ArcadeRun } from '@/hooks/use-arcade-run'
import { usePersistedRose } from '@/hooks/use-persisted-rose'
import { horizonOf, type Sheet } from '@/lib/arcade-tilt'
import { UP, type Crossroad } from '@/machines/arcade'

const CAMERA_IN: readonly ArcadePhase[] = [
  'closing',
  'siege',
  'overrun',
  'springing',
  'ambush',
]

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
  // An ambush is fought at a standstill too: the hero stops partway along the way it was
  // walking and holds there, so the canvas has nothing to cover for either beat. `cleared`
  // is the rest of that way, which it does cover; `driven` is the way back, which is the
  // retreat's own distance travelled in the retreat's own time.
  springing: 0,
  ambush: 0,
  cleared: CLEARED_MS,
  driven: RETREAT_MS,
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
  // The hero holds where the ambush caught it for both of the fight's own beats, the way it
  // holds at a gate — and `springing` sets it once for the same reason `closing` does, to
  // put it on the spring point the frame chose rather than to move it.
  springing: null,
  ambush: null,
  // The rest of the way, walked on the same spline from wherever the fight was fought from.
  // No `from`, for the reason `taken` has none.
  cleared: {
    from: null,
    to: 1,
    duration: CLEARED_MS,
    easing: Easing.inOut(Easing.cubic),
  },
  // And the way back, from wherever that was to the crossroad it set off from. Eased in
  // only, like every other beat that happens *to* the player rather than being a move they
  // made.
  driven: { from: null, to: 0, duration: RETREAT_MS, easing: Easing.in(Easing.cubic) },
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

// A mode switch has no beat of its own, so the sheet takes this long to come round.
const TURN_MS = 620

// Whether what lies along the way to a crossroad is a fight. Both kinds, because two things
// on this screen ask the question and neither of them cares which kind it is: how far along
// the way the hero gets, and whether the sheet squares up to what is at the end of it.
const fightAt = (to: Crossroad | undefined): boolean =>
  to?.fortified === true || to?.ambushed === true

// The camera over ADVENTURE's map: the clocks every mark on it reads, the pan that follows
// the hero, the zoom into a fight, the turn the sheet lies at and its tilt — and how far
// along its way the hero has got. Everything the sheet is drawn through, in one place, so
// `ArcadeGame` only says what is on it.
export function useArcadeCamera({
  run,
  pitch,
  canvasHeight,
  frame,
}: {
  run: ArcadeRun
  // How many points one unit of the map is, for this canvas.
  pitch: number
  canvasHeight: number
  // How the fight ahead is framed: how far the sheet lifts, and where the hero stands off.
  frame: { lift: number; standoff: number }
}) {
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

  const destination = run.destination
  // Where the sheet has to stand for the destination to land on the anchor. The *focus*
  // only — the anchor itself is a fixed point of the canvas and belongs to the view that
  // pivots about it, not to the value that animates.
  const driftX = destination === undefined ? 0 : -destination.pos.x * pitch
  const driftY = destination === undefined ? 0 : -destination.pos.y * pitch

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
    // A fight squares the sheet up, whichever fight it is. A wall wants to lie across the
    // top of the canvas; a road wants to run straight up it, so that a bandit's bearing is
    // read against the way the hero was going rather than against whatever angle the map
    // happened to be lying at.
    const squared = fightAt(destination)
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
    // A walk that ends in a fight stops short of its own end: at the gate when there are
    // walls, and partway along the road when there are men on it. The second is read off
    // the map rather than off the phase, because the beat that has to stop short is the
    // walk itself — the fight is not sprung until it has.
    const stop = fightAt(run.destination) ? frame.standoff : 1
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
    if (isOneOf(run.phase, ['closing', 'springing'])) {
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
    horizon: horizonOf(canvasHeight),
  }))

  return {
    clock,
    now,
    camTurn,
    progress,
    northUp,
    setNorthUp,
    sheetTurn,
    sheetPan,
    country,
    sheet,
  }
}
