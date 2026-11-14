// What is on ADVENTURE's map this frame: the ways out of where the hero stands, the trail
// behind, the villages at their ends, the roads with men on them, a strike's far way, and
// the way the hero is on. Pure — worked out from the run each render, and drawn by
// `ArcadeSheet`.

import { isOneOf } from 'narrowland'

import type { BudState } from '@/components/game/way-bud'
import type { StemState } from '@/components/game/way-stem'
import { AMBUSH_ALONG } from '@/constants/ambush'
import { STAGGER_MS, TRAIL_DEPTH } from '@/constants/arcade'
import type { ArcadePhase, ArcadeRun } from '@/hooks/use-arcade-run'
import {
  mouthStub,
  pointsOf,
  splineFor,
  splinePoint,
  type Spline,
} from '@/lib/arcade-layout'
import { idSeed } from '@/machines/arcade'

// How much of the sheet a village's name needs to itself before a neighbour's would cross
// it. The label is a serif at 9pt and at most thirteen characters, which comes to about this.
const NAME_ROOM = 74

// How far back the hero's own history stays legible. The way it is standing on is at full
// strength; what is behind that is there to say where the run came from.
const FADES = [1, 0.45, 0.2] as const

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

// Every beat the hero is somewhere along a way rather than standing on a crossroad, and so
// is drawn on a spline out of the one behind it. A walk and a strike, and the four beats of
// an ambush — which is a walk stopped in the middle, fought over, and then either finished
// or given up.
const ON_A_WAY: readonly ArcadePhase[] = [
  'walk',
  'rocket',
  'springing',
  'ambush',
  'cleared',
  'driven',
]

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
  // An ambush has no crossroad clock either. What is counting down is the band, and the
  // crossroad behind holds whatever it had left — a hero driven home finds the fan it left,
  // with its clocks started again.
  springing: null,
  ambush: null,
  cleared: null,
  driven: null,
  overrun: null,
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

export function canvasOf({
  run,
  pitch,
  standoff,
}: {
  run: ArcadeRun
  pitch: number
  // Where along its way the hero holds for a fight — see `frameFor`.
  standoff: number
}) {
  const here = run.standing
  const stems: StemSpec[] = []
  const buds: BudSpec[] = []
  // The roads on this fan the hero has already been driven off, and where along each the
  // men are waiting. Never the first time — see AmbushMark.
  const waylaid: { key: string; x: number; y: number }[] = []
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
        // costs not a frame. A way whose village has given up trims back into the crossroad
        // with it, and by the same wither a refused way uses — the two are one thing
        // happening for different reasons, and a road still drawn to a town that is gone is
        // a road to nowhere.
        state: chosen
          ? 'steady'
          : leaving || run.expired.includes(way.to)
            ? 'withering'
            : 'growing',
        creepMs: null,
        creepFrom: 0,
        delay: i * STAGGER_MS,
        fade: 1,
        gradientId: gradientFor(way.to),
      })
      if (run.waylaidAt(way.to)) {
        const at = splinePoint(spline, AMBUSH_ALONG)
        waylaid.push({ key: way.to, x: herePt.x + at.x, y: herePt.y + at.y })
      }
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
    // The four beats of an ambush ride the same way a walk does, from the same crossroad:
    // the hero never arrived anywhere, it was stopped in the middle of the road — and the
    // way back out of that is the same curve walked the other way.
    if (isOneOf(run.phase, ON_A_WAY) && run.moving !== null) {
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
  // Read at the stand-off, which is where it holds for the whole of a fight.
  const stand = hero.spline === null ? { x: 0, y: 0 } : splinePoint(hero.spline, standoff)

  return {
    stems,
    buds,
    waylaid,
    stub,
    nearMouth,
    mouthFade,
    dawn,
    leaving,
    skipped,
    hero,
    stand,
  }
}

export type ArcadeCanvas = ReturnType<typeof canvasOf>
