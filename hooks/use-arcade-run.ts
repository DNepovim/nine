import { isOneOf } from 'narrowland'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  BLOOM_MS,
  DAWN_MS,
  FALL_MS,
  RETREAT_MS,
  ROCKET_MS,
  TRAIL_DEPTH,
  WALK_MS,
} from '@/constants/arcade'
import { CLOSE_MS, HEARTS, OVERRUN_MS, TAKEN_MS } from '@/constants/siege'
import { publishArcadeDev, type ArcadeDevActions } from '@/dev/arcade-dev-state'
import { usePauseOnBlur } from '@/hooks/use-pause-on-blur'
import { track } from '@/lib/analytics'
import {
  ARCADE_DIAL,
  crossroadClock,
  deepen,
  isStrike,
  newMap,
  openCrossroad,
  START,
  straightestWay,
  trail,
  wayInto,
  type ArcadeMap,
  type ArcadeWay,
  type Crossroad,
} from '@/machines/arcade'
import {
  biteFor,
  FULL,
  RETREAT_BITE,
  spent,
  STARVE_MS,
  starving,
} from '@/machines/satiety'
import { computePar } from '@/machines/scoring'
import {
  advance,
  land,
  newSiege,
  nextEvent,
  opened,
  shift,
  type Siege,
} from '@/machines/siege'
import { emptyGrid, pressGrid, setGrid, sumOf, type Grid } from '@/modes'

// One arcade run: where the hero stands, what the crossroad offers, and the clock that
// drags it back down. The rules it leans on are in machines/arcade.ts; what is here is the
// part that needs a clock and a render.
//
// Not the game machine. A run of this scores no points, keeps no lives and writes to no
// board, so there was nothing for it to borrow but the grid — which it does, through the
// same two builders every press in the app goes through.

// The beats a run moves through. `dawn` is the card the run opens on — nothing is drawn and
// nothing is listening, because there is no crossroad to answer yet. `bloom` and `open` are
// both dialable: the clock only starts once the fan is drawn, and a player quick enough to
// answer before it does has earned the head start.
//
// `rocket` is a walk that does not stop — see the strike below.
//
// The four at the end are a siege. `closing` is the camera coming down on the walls, with
// the hero stopped short of the gate; `siege` is the fight and is dialable; `taken` is the
// last tower falling; `overrun` is the last heart going, which is the one end arcade has
// that is not the mouth.
export type ArcadePhase =
  | 'dawn'
  | 'bloom'
  | 'open'
  | 'walk'
  | 'rocket'
  | 'retreat'
  | 'falling'
  | 'closing'
  | 'siege'
  | 'taken'
  | 'overrun'
  | 'over'

const DIALABLE: readonly ArcadePhase[] = ['bloom', 'open', 'siege']

// How long each beat lasts, for the beats that end on a clock of their own rather than on
// the crossroad's. `open` is missing because its length is the crossroad's clock, and the
// three that end nothing are missing because nothing ends them.
const BEAT_MS = {
  dawn: DAWN_MS,
  bloom: BLOOM_MS,
  walk: WALK_MS,
  rocket: ROCKET_MS,
  retreat: RETREAT_MS,
  falling: FALL_MS,
  closing: CLOSE_MS,
  taken: TAKEN_MS,
  overrun: OVERRUN_MS,
} as const satisfies Partial<Record<ArcadePhase, number>>

const INITIAL_GRID: Grid = emptyGrid(ARCADE_DIAL)

type Run = {
  // The whole run is this number: the map is grown from it, so the same seed walks the same
  // way every time and a run can be replayed from one figure.
  seed: number
  map: ArcadeMap
  at: string
  phase: ArcadePhase
  grid: Grid
  // The deepest crossroad this run reached, which is the score. A high-water mark, so a
  // retreat costs the depth the hero stands at and not the run.
  best: number
  // The way being travelled, and nothing while the hero stands. On a retreat it is the way
  // *in* rather than a way out — the same curve, walked the other way.
  moving: ArcadeWay | null
  // On a strike, the second way of the same movement: the one out of the crossroad the
  // hero is about to pass through without stopping. Null on every other beat.
  through: ArcadeWay | null
  // How many strikes this run has called. A run stat, like the game's own.
  strikes: number
  // Hearts. The one thing in arcade a siege can spend and nothing else can: a retreat at
  // an ordinary crossroad still costs only depth, as it always has.
  hearts: number
  // The fight the hero is in, and nothing at every other moment.
  siege: Siege | null
  // How many villages this run has taken. A run stat, like the strikes.
  taken: number
  // How fed the hero is, nought to one. Full at dawn, spent by walking, filled by taking
  // a village — see machines/satiety.ts for what each of those costs and gives.
  satiety: number
  // The grid the fan the hero is standing at was opened against, which is what a leg's par
  // is measured from.
  //
  // A snapshot rather than a number on the way, and for the reason the game machine keeps
  // `refGrid` on a target: par has to be measured from where the player started dialling.
  // It cannot be precomputed when the fan is grown either — a retreat comes back to a
  // crossroad whose ways were chosen against an older grid, and the player's own presses
  // have moved it since.
  legGrid: Grid
  // Presses made since the hero arrived here, the landing one included. Reset on every
  // arrival, so a siege's dozens never reach the leg out of the village it took.
  legPresses: number
  // Whether a warrior reaching the hero costs a heart. Always true in a shipped build —
  // the dev sidebar is the only thing that can turn it off, and it is folded out with
  // `__DEV__`. A long siege is the one thing in the mode that cannot be watched to the end
  // without surviving it, and three hearts is about forty seconds.
  //
  // It guards the warriors only. Hunger still bites and RETREAT is gone, so a run with this
  // off is still a run that can end — this makes the walls survivable, not the mode.
  invincible: boolean
  // Wall clock of the next heart to go to hunger, and null while there is food left.
  //
  // A stamp rather than a countdown, so a pause can be resumed by shifting it the way
  // `shift` already shifts every clock in a siege.
  starvingAt: number | null
  // When the current beat started, and how much of it had run when the run was paused.
  //
  // Together they are what makes a pause resumable without a second clock: every timer is
  // set to what is *left* of its beat rather than to the whole of it, and resuming shifts
  // `beatAt` forward by however long the pause lasted so that what is left is the same as
  // it was. `heldMs` is also what the red creeping up the way behind restarts from.
  beatAt: number
  heldMs: number
  paused: boolean
  // How long this run has actually been played, not counting time spent on the pause
  // screen — the same figure, and the same rule, as the game's own TIME.
  playedMs: number
  playingSince: number
  // Bumped on every beat, so an effect that has to restart a clock or an animation can tell
  // a new crossroad from a re-render of the one before it.
  seq: number
}

const startRun = (seed: number, now: number): Run => ({
  seed,
  map: openCrossroad(newMap(seed), START, INITIAL_GRID, seed),
  at: START,
  phase: 'dawn',
  grid: INITIAL_GRID,
  best: 0,
  moving: null,
  through: null,
  strikes: 0,
  hearts: HEARTS,
  siege: null,
  taken: 0,
  satiety: FULL,
  legGrid: INITIAL_GRID,
  legPresses: 0,
  invincible: false,
  starvingAt: null,
  beatAt: now,
  heldMs: 0,
  paused: false,
  playedMs: 0,
  playingSince: now,
  seq: 1,
})

// Every transition starts a fresh beat, which is what the resumable timer above is
// measured from. One place, so no transition can forget to stamp it.
const beat = (run: Run, now: number): Pick<Run, 'beatAt' | 'heldMs' | 'seq'> => ({
  beatAt: now,
  heldMs: 0,
  seq: run.seq + 1,
})

// The beats a run is finishing on. Hunger stops biting here: the hearts are spent, the
// card is on its way, and a heart taken off a run that has already ended would be a fourth
// way to die arriving after the other three.
const ENDING: readonly ArcadePhase[] = ['overrun', 'falling', 'over']

// Everything a fresh leg is measured from. Stamped wherever the hero arrives somewhere
// with a fan to answer — after a walk, a rocket, a retreat, and a village taken — so no
// arrival can forget to clear the presses the one before it made. One place, for the same
// reason `beat` is one place.
const arrival = (grid: Grid): Pick<Run, 'legGrid' | 'legPresses'> => ({
  legGrid: grid,
  legPresses: 0,
})

// What eating or going without leaves behind: how fed the hero is, and the clock the
// hearts go on once there is nothing left.
//
// One place, so nothing that spends can forget to start the starving and nothing that
// feeds can forget to stop it. The clock is armed on the falling edge only — a bite taken
// by a hero who is already starving leaves the one that is running alone, or every step
// on an empty belly would buy another five seconds.
const eat = (
  run: Run,
  satiety: number,
  now: number,
): Pick<Run, 'satiety' | 'starvingAt'> => ({
  satiety,
  starvingAt: starving(satiety) ? (run.starvingAt ?? now + STARVE_MS) : null,
})

const freshSeed = (): number => Math.floor(Math.random() * 0x7fffffff)

export function useArcadeRun() {
  const [run, setRun] = useState<Run>(() => startRun(freshSeed(), Date.now()))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Hunger's own clock, and the one thing here that does not run on the beat.
  //
  // Every other timer in this hook is the beat's: one at a time, cleared and re-armed by
  // the effect below as the run moves from one to the next. Starving is not a beat — it
  // ticks *across* them, through the bloom and the open and the walk and the fight alike
  // — so it cannot share that ref without one of the two clearing the other. Its own ref
  // and its own effect, and the two never touch.
  const hunger = useRef<ReturnType<typeof setTimeout> | null>(null)

  const standing: Crossroad | undefined = run.map[run.at]
  const depth = standing?.depth ?? 0
  const clockMs = crossroadClock(depth)

  // The run stops the moment the app stops being the thing on screen.
  //
  // Here rather than on the screen, so a run of this gets it by being a run rather than
  // by somebody remembering to ask: every clock in here is wall-clock — the beat, the
  // crossroad's own countdown, the time played — and every one of them keeps running
  // while the phone is in a pocket. A player who took a call used to come back to a hero
  // that had already been dragged off the crossroad it was standing on.
  //
  // `pauseRun` rather than the returned `pause`, which is a fresh closure every render;
  // the hook holds whichever it was last handed, but a stable one keeps that moot. The
  // state updater reads the clock itself, so there is nothing to capture.
  const pauseRun = useCallback(() => {
    const now = Date.now()
    setRun((r) =>
      r.paused
        ? r
        : {
            ...r,
            paused: true,
            heldMs: now - r.beatAt,
            playedMs: r.playedMs + (now - r.playingSince),
          },
    )
  }, [])

  // Only while the dial is listening — standing on a crossroad, or fighting at a walled
  // village — which is the same beat the pause button appears on and the only kind where
  // going away costs anything. JS timers are frozen while the app is backgrounded, so the
  // crossroad's own countdown fires the instant the app comes back and the hero is dragged
  // off a crossroad the player never got to answer; in a siege it is the gate that fires,
  // and every man already on the ground arrives at once.
  //
  // Mid-flight is deliberately left running. A movement is a second at most, so there is
  // next to nothing to save, and stopping there would freeze a screen that has to be
  // resumed into a Reanimated animation which carried on without it.
  usePauseOnBlur(!run.paused && isOneOf(run.phase, DIALABLE), pauseRun)

  // Both edges of a run, tracked here rather than in the screen: this is the one place
  // that knows when a run actually begins and ends, and it would otherwise have to leak
  // its state out through `onEnd` for a screen to say the same thing a beat later.
  //
  // `run.seed` is minted fresh exactly at START and at `restart`, and nowhere else — see
  // `startRun` — so a run of this has one seed for its whole life and the effect fires
  // once per run, the first included.
  useEffect(() => {
    track('arcade_run_started', {})
  }, [run.seed])

  // Latched on the rising edge into `over`, the same way the step-up toast's own offer
  // is — `run.phase` holds at `over` once the screen takes it, and firing on every
  // render it stays there would count one run as many.
  const endedRef = useRef(false)
  useEffect(() => {
    const ended = run.phase === 'over'
    if (ended && !endedRef.current) {
      // `best` rather than `depth`: it is the deepest crossroad the run ever reached,
      // which is what the end-of-run screen shows as the score — `depth` alone would
      // read as a run worth less than the one the player just watched end.
      track('arcade_run_finished', {
        depth: run.best,
        strikes: run.strikes,
        playedMs: run.playedMs,
      })
    }
    endedRef.current = ended
  }, [run.phase, run.best, run.strikes, run.playedMs])

  // What ends each beat. One timer rather than one per phase, cleared by the effect that
  // set it — a press can end `open` early, and the clock it was running has to go with it.
  //
  // Each is set to what is left of its beat rather than to the whole of it, so a beat that
  // has been paused and resumed ends when it would have ended anyway.
  useEffect(() => {
    if (run.paused) return
    const elapsed = Date.now() - run.beatAt
    const after = (full: number, step: () => void) => {
      timer.current = setTimeout(step, Math.max(0, full - elapsed))
    }

    // The words the run opens on, and then the first fan. The map is already grown by this
    // point — the run was dealt with the screen — so all this beat does is hold it back
    // until there is something on the screen worth blooming into.
    if (run.phase === 'dawn') {
      after(BEAT_MS.dawn, () => {
        const now = Date.now()
        setRun((r) =>
          r.phase === 'dawn'
            ? // The run's own clock starts here rather than when the screen opened: TIME is
              // how long the player played, and the card is not play. Nothing is added to
              // `playedMs` — the words simply never counted.
              { ...r, phase: 'bloom', playingSince: now, ...beat(r, now) }
            : r,
        )
      })
    }

    if (run.phase === 'bloom') {
      after(BEAT_MS.bloom, () => {
        const now = Date.now()
        setRun((r) =>
          r.phase === 'bloom' ? { ...r, phase: 'open', ...beat(r, now) } : r,
        )
      })
    }

    // The clock ran out. One crossroad back — or, with none behind to go back to, down the
    // stub into the mouth. One of the two ways a run ends; the other is being overrun at a
    // walled village, which is what `overrun` below is.
    if (run.phase === 'open') {
      after(clockMs, () => {
        const now = Date.now()
        setRun((r) => {
          if (r.phase !== 'open') return r
          const here = r.map[r.at]
          if (here?.from == null) {
            return {
              ...r,
              phase: 'falling',
              moving: null,
              // The run is over at this point, so this is where its clock stops.
              playedMs: r.playedMs + (now - r.playingSince),
              playingSince: now,
              ...beat(r, now),
            }
          }
          return {
            ...r,
            phase: 'retreat',
            moving: wayInto(r.map, r.at),
            // The largest bite there is, and no accuracy relief: there was no answer to be
            // accurate about. Charged as the retreat begins rather than when it lands, so
            // the bar empties with the hero being dragged rather than after it.
            ...eat(r, spent(r.satiety, RETREAT_BITE), now),
            ...beat(r, now),
          }
        })
      })
    }

    if (run.phase === 'walk') {
      after(BEAT_MS.walk, () => {
        const now = Date.now()
        setRun((r) => {
          const way = r.moving
          if (r.phase !== 'walk' || way === null) return r
          const landed = r.map[way.to]?.depth ?? 0
          // A walled village is not walked into. The hero stops short of the gate, the
          // camera comes down, and the fan at the far end waits until the walls are down —
          // which is why `openCrossroad` is not called here for one.
          if (r.map[way.to]?.fortified === true) {
            return {
              ...r,
              at: way.to,
              phase: 'closing',
              moving: null,
              best: Math.max(r.best, landed),
              siege: newSiege(way.to, landed, r.seed, r.grid, now),
              // Nothing to answer behind the walls, but the presses the fight is about to
              // make are not the next leg's and must not be billed to it.
              ...arrival(r.grid),
              ...beat(r, now),
            }
          }
          // The fan at the far end is grown now rather than when the way was offered, so it
          // is measured against the grid the player arrives holding.
          const map = openCrossroad(r.map, way.to, r.grid, r.seed)
          return {
            ...r,
            map,
            at: way.to,
            phase: 'bloom',
            moving: null,
            best: Math.max(r.best, landed),
            // The fan here was grown against this grid, so this is what the next leg's par
            // is measured from.
            ...arrival(r.grid),
            ...beat(r, now),
          }
        })
      })
    }

    // A strike lands two crossroads on, having never stopped at the one between. The map
    // there was already grown when the strike was called — the way out of it had to be a
    // way the map actually had — so this only has to grow the fan where the hero stops.
    if (run.phase === 'rocket') {
      after(BEAT_MS.rocket, () => {
        const now = Date.now()
        setRun((r) => {
          const through = r.through
          if (r.phase !== 'rocket' || through === null) return r
          const landed = r.map[through.to]?.depth ?? 0
          // A rocket that lands on a walled village stops at the gate like any other
          // arrival: the walls are what it came to, so there is no fan to grow yet.
          if (r.map[through.to]?.fortified === true) {
            return {
              ...r,
              at: through.to,
              phase: 'closing',
              moving: null,
              through: null,
              best: Math.max(r.best, landed),
              siege: newSiege(through.to, landed, r.seed, r.grid, now),
              ...arrival(r.grid),
              ...beat(r, now),
            }
          }
          const map = openCrossroad(r.map, through.to, r.grid, r.seed)
          return {
            ...r,
            map,
            at: through.to,
            phase: 'bloom',
            moving: null,
            through: null,
            best: Math.max(r.best, landed),
            ...arrival(r.grid),
            ...beat(r, now),
          }
        })
      })
    }

    if (run.phase === 'retreat') {
      after(BEAT_MS.retreat, () => {
        const now = Date.now()
        setRun((r) => {
          const back = r.map[r.at]?.from
          if (r.phase !== 'retreat' || back === undefined || back === null) return r
          // No map change: the crossroad behind keeps the fan it was grown with, so the ways
          // the hero comes back to are the ones it left — including the one it just failed
          // at, which is still a way.
          return {
            ...r,
            at: back,
            phase: 'bloom',
            moving: null,
            // The fan behind was grown long ago, against a grid the hero's own presses have
            // moved since. Par for the ways it offers is measured from the grid the hero
            // comes back holding, which is this one.
            ...arrival(r.grid),
            ...beat(r, now),
          }
        })
      })
    }

    // The camera has come down. The fight starts — and the gate's first clock starts with
    // it rather than with the arrival, which is what makes `SPAWN_FIRST_MS` the grace the
    // player actually gets. See `opened` in machines/siege.
    if (run.phase === 'closing') {
      after(BEAT_MS.closing, () => {
        const now = Date.now()
        setRun((r) =>
          r.phase === 'closing'
            ? {
                ...r,
                phase: 'siege',
                siege: r.siege === null ? null : opened(r.siege, now),
                ...beat(r, now),
              }
            : r,
        )
      })
    }

    // The fight itself. One timer, armed to whichever happens first — a warrior leaving
    // the gate or one reaching the hero — and re-armed by the `seq` bump every event
    // carries, which is the same single-timer shape every other beat here uses.
    if (run.phase === 'siege' && run.siege !== null) {
      const due = nextEvent(run.siege)
      timer.current = setTimeout(
        () => {
          const now = Date.now()
          setRun((r) => {
            if (r.phase !== 'siege' || r.siege === null) return r
            const step = advance(r.siege, r.grid, now)
            if (!step.lost) return { ...r, siege: step.siege, ...beat(r, now) }
            // He still arrives and is still cleared off the ground — only the heart is
            // spared. A guard that skipped the whole step would leave him standing on the
            // hero forever, which is not the fight being tested.
            if (r.invincible) return { ...r, siege: step.siege, ...beat(r, now) }
            const hearts = r.hearts - 1
            if (hearts > 0) {
              return { ...r, siege: step.siege, hearts, ...beat(r, now) }
            }
            return {
              ...r,
              siege: step.siege,
              hearts: 0,
              phase: 'overrun',
              // The run is over at this point, so this is where its clock stops.
              playedMs: r.playedMs + (now - r.playingSince),
              playingSince: now,
              ...beat(r, now),
            }
          })
        },
        Math.max(0, due - Date.now()),
      )
    }

    // The walls are down. The hero walks in and the village offers its own fan, measured
    // against the grid the fight left behind.
    if (run.phase === 'taken') {
      after(BEAT_MS.taken, () => {
        const now = Date.now()
        setRun((r) => {
          if (r.phase !== 'taken') return r
          // The fan is grown *before* the walls come off, and that order is the whole of
          // it: `openCrossroad` reads `fortified` to force a walled village's own fan dry,
          // which is what stops a siege opening straight out of a siege. Clear the flag
          // first — the obvious simplification — and the village just taken would offer
          // another one crossroad on.
          //
          // Cleared it must be, though. Taken is taken: a village that kept its walls
          // would be a heart to be farmed by walking out and back in again.
          const grown = openCrossroad(r.map, r.at, r.grid, r.seed)
          const here = grown[r.at]
          const map =
            here === undefined
              ? grown
              : { ...grown, [r.at]: { ...here, fortified: false } }
          return {
            ...r,
            map,
            phase: 'bloom',
            siege: null,
            // The fight's presses end here. Without this the first leg out of every village
            // would be billed for the dozens of them a siege takes.
            ...arrival(r.grid),
            ...beat(r, now),
          }
        })
      })
    }

    if (run.phase === 'overrun') {
      after(BEAT_MS.overrun, () => {
        const now = Date.now()
        setRun((r) =>
          r.phase === 'overrun' ? { ...r, phase: 'over', ...beat(r, now) } : r,
        )
      })
    }

    if (run.phase === 'falling') {
      after(BEAT_MS.falling, () => {
        const now = Date.now()
        setRun((r) =>
          r.phase === 'falling' ? { ...r, phase: 'over', ...beat(r, now) } : r,
        )
      })
    }

    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
  }, [run.phase, run.seq, run.paused, run.beatAt, clockMs])

  // Starving: a heart every STARVE_MS while there is nothing left to eat.
  //
  // Armed off `starvingAt`, which is a wall-clock stamp rather than a countdown, so what
  // is left of the five seconds survives a pause without a second figure to carry — the
  // same trick the beat uses with `beatAt`, and the same one `shift` uses on a siege.
  //
  // It does not stop the run. The crossroad's clock keeps running, the dial keeps
  // listening and the map keeps offering ways — a hero on its last heart with an empty
  // bar has fifteen seconds and a choice about where to spend them, which is the whole
  // point of the mechanic.
  useEffect(() => {
    if (run.paused) return
    if (run.starvingAt === null) return
    if (isOneOf(run.phase, ENDING)) return

    hunger.current = setTimeout(
      () => {
        const now = Date.now()
        setRun((r) => {
          if (r.paused || r.starvingAt === null) return r
          if (isOneOf(r.phase, ENDING)) return r
          const hearts = r.hearts - 1
          if (hearts > 0) {
            // No `beat` here, and that is not an omission. Every beat timer in this hook
            // is measured from `beatAt`, so stamping a fresh one would hand the player
            // the crossroad's clock all over again — a heart lost would buy time rather
            // than cost it. A heart going is not a beat; it is something that happens
            // during whichever beat is already running.
            return { ...r, hearts, starvingAt: now + STARVE_MS }
          }
          // The last heart, and the end arcade already has. The siege field, if there is
          // one, is left where it stands: `overrun` is a beat the player watches, and
          // clearing it would empty the screen the run ends on.
          return {
            ...r,
            hearts: 0,
            starvingAt: null,
            phase: 'overrun',
            // The run is over at this point, so this is where its clock stops.
            playedMs: r.playedMs + (now - r.playingSince),
            playingSince: now,
            ...beat(r, now),
          }
        })
      },
      Math.max(0, run.starvingAt - Date.now()),
    )

    return () => {
      if (hunger.current !== null) clearTimeout(hunger.current)
      hunger.current = null
    }
  }, [run.paused, run.starvingAt, run.phase])

  // A press, by way of the same two builders the game machine presses through — so a key
  // behaves here exactly as it does in a run of Accuracy.
  //
  // The grid is built *inside* the update rather than handed in already built, because one
  // drag across the dial is several presses in one tick: a move measured against the grid
  // this render closed over would answer for the key before last and drop the rest.
  const applyMove = (build: (grid: Grid) => Grid, now: number) => {
    setRun((r) => {
      if (r.paused || !isOneOf(r.phase, DIALABLE)) return r
      const next = build(r.grid)
      const sum = sumOf(ARCADE_DIAL, next)

      // In a siege the sum answers to the walls rather than to a fan.
      if (r.phase === 'siege' && r.siege !== null) {
        const hit = land(r.siege, sumOf(ARCADE_DIAL, r.grid), sum, next, now)
        if (!hit.taken) return { ...r, grid: next, siege: hit.siege }
        return {
          ...r,
          grid: next,
          // The ground cleared with the last tower. The field stays mounted for the whole
          // of `taken` — the walls coming down is the thing being watched — and the hero
          // leaves the stand-off the moment the press lands, so every man still crossing
          // would be walking at a patch of ground nobody is on. They could not reach
          // anyone either: no timer is armed outside `siege`. A village that has given up
          // has nobody left in the field.
          siege: { ...hit.siege, warriors: [] },
          phase: 'taken',
          // One heart back for the village, and never a fourth.
          hearts: Math.min(HEARTS, r.hearts + 1),
          taken: r.taken + 1,
          // And the village's food, which is the only food on the map. Both, not one or
          // the other: a siege is the one thing in the mode worth walking toward.
          ...eat(r, FULL, now),
          ...beat(r, now),
        }
      }

      // The press counts toward this leg from here down. Below the siege branch on
      // purpose: a press at the walls answers to the towers, and billing the fight to the
      // leg out of the village would make the first crossroad past every siege the
      // dearest one on the map.
      const presses = r.legPresses + 1

      const taken = r.map[r.at]?.ways.find((way) => way.value === sum)
      if (taken === undefined) return { ...r, grid: next, legPresses: presses }

      // What the leg costs, from the grid the fan here was opened against and the presses
      // it actually took. Worked out once and spent down all three roads out of this
      // branch — a walk, a walk into walls, and a rocket — because they are one answer
      // given three ways, not three answers.
      //
      // A strike is charged this once and no more. The crossroad a rocket passes through
      // was never answered, and the free leg is part of what being fast already buys.
      const bite = biteFor(computePar(ARCADE_DIAL, r.legGrid, taken.value), presses)
      const fed = eat(r, spent(r.satiety, bite), now)

      // Fast enough to be a strike? The clock this crossroad was given, less what has run
      // off it — and all of it still full while the fan was blooming, which is the head
      // start a player quick enough to answer before the clock starts has earned.
      const answered = crossroadClock(r.map[r.at]?.depth ?? 0)
      const leftMs = r.phase === 'open' ? answered - (now - r.beatAt) : answered
      const struck = isStrike(leftMs, answered)

      // A strike cannot skip a siege: the rocket's first hop is a crossroad it passes
      // *through* without stopping, and a village with walls on it is not passed through.
      // It still counts as a strike — it was answered fast — it simply has nowhere to
      // rocket to, so the walk it degrades to carries the stat with it.
      //
      // Two cases, not one. Walking into those same walls slowly was never a strike and
      // adds nothing, which is why `struck` is asked again here rather than assumed.
      if (r.map[taken.to]?.fortified === true) {
        return {
          ...r,
          grid: next,
          phase: 'walk',
          moving: taken,
          strikes: struck ? r.strikes + 1 : r.strikes,
          legPresses: presses,
          ...fed,
          ...beat(r, now),
        }
      }

      if (!struck) {
        return {
          ...r,
          grid: next,
          phase: 'walk',
          moving: taken,
          legPresses: presses,
          ...fed,
          ...beat(r, now),
        }
      }

      // A strike. The crossroad the hero is about to pass through is opened here rather
      // than on arrival, because the way *out* of it has to be a way the map already has:
      // the rocket is taking it, and nothing may be rolled mid-flight. It opens against
      // the same grid an arrival would have opened it with, so the fan is the same fan
      // either way.
      const map = openCrossroad(r.map, taken.to, next, r.seed)
      const through = straightestWay(map[taken.to])
      if (through === null) {
        return {
          ...r,
          grid: next,
          phase: 'walk',
          moving: taken,
          legPresses: presses,
          ...fed,
          ...beat(r, now),
        }
      }
      return {
        ...r,
        grid: next,
        map,
        phase: 'rocket',
        moving: taken,
        through,
        strikes: r.strikes + 1,
        legPresses: presses,
        ...fed,
        ...beat(r, now),
      }
    })
  }

  const parentId = standing?.from ?? null

  // What the land has to keep clear of: the ways in sight and the settlements on them.
  // Asked of the run because only this hook holds the map — see hooks/use-arcade-land.ts.
  const sightOf = () => {
    const ways: { ax: number; ay: number; bx: number; by: number }[] = []
    const places: { x: number; y: number }[] = []
    if (standing !== undefined) {
      places.push({ x: standing.pos.x, y: standing.pos.y })
      for (const way of standing.ways) {
        const to = run.map[way.to]
        if (to === undefined) continue
        ways.push({ ax: standing.pos.x, ay: standing.pos.y, bx: to.pos.x, by: to.pos.y })
        places.push({ x: to.pos.x, y: to.pos.y })
      }
    }
    for (const step of trail(run.map, run.at, TRAIL_DEPTH)) {
      const to = run.map[step.way.to]
      if (to === undefined) continue
      ways.push({ ax: step.from.pos.x, ay: step.from.pos.y, bx: to.pos.x, by: to.pos.y })
      places.push({ x: step.from.pos.x, y: step.from.pos.y })
    }
    return { ways, places }
  }

  // Where the movement in flight ends, which is what the canvas follows. Asked of the run
  // rather than worked out by the screen, because only this hook holds the map.
  const destinationOf = (): Crossroad | undefined => {
    if (run.phase === 'walk' && run.moving !== null) return run.map[run.moving.to]
    // Two crossroads on, not one: a rocket's destination is where it *stops*.
    if (run.phase === 'rocket' && run.through !== null) return run.map[run.through.to]
    if (run.phase === 'retreat' && parentId !== null) return run.map[parentId]
    return standing
  }

  // The dev tools, and nothing a player can reach: they are published to a module-level
  // store that only the `__DEV__` sidebar reads, and folded out of a shipped build with it.
  //
  // They go through the same `setRun` and stamp the same `beat` as every other transition,
  // so a forced siege is dealt by the machinery a dialled one is — which is the whole point
  // of having them. A tool that took a shortcut past the beats would be testing itself
  // rather than the mode.
  const dev: ArcadeDevActions = {
    // A siege at the village the hero is standing on, whatever that village is.
    //
    // Marks it walled first, because everything downstream reads that flag rather than the
    // phase: `taken` clears it when the walls come down, the bud is drawn heavier, and
    // `openCrossroad` keeps the fan out of it dry.
    //
    // Refused at the start, and the sidebar says why. The hero is drawn on the way it came
    // in for the whole fight, and the first crossroad has no way in — there it would be
    // drawn falling down the stub into the mouth instead, which is the other death.
    siegeNow: () => {
      const now = Date.now()
      setRun((r) => {
        const here = r.map[r.at]
        // Two guards rather than one: the second needs `here` narrowed, and an optional
        // chain over both would hand back a crossroad that might not be there.
        if (here === undefined) return r
        if (here.from === null) return r
        if (!isOneOf(r.phase, DIALABLE)) return r
        return {
          ...r,
          map: { ...r.map, [r.at]: { ...here, fortified: true } },
          phase: 'closing',
          moving: null,
          through: null,
          siege: newSiege(r.at, here.depth, r.seed, r.grid, now),
          ...beat(r, now),
        }
      })
    },

    // Climb `steps` crossroads without dialling them. Reaching a six-tower siege by hand is
    // about two dozen, and climbing them to look at one thing is how a check stops getting
    // made.
    deepenBy: (steps: number) => {
      const now = Date.now()
      setRun((r) => {
        if (!isOneOf(r.phase, DIALABLE)) return r
        const walked = deepen(r.map, r.at, r.grid, r.seed, steps)
        const landed = walked.map[walked.at]?.depth ?? 0
        return {
          ...r,
          map: walked.map,
          at: walked.at,
          phase: 'bloom',
          moving: null,
          through: null,
          siege: null,
          best: Math.max(r.best, landed),
          ...beat(r, now),
        }
      })
    },

    // Hearts, set rather than spent. Floored at one: a run that ends has a beat to play and
    // a card to choose between, and letting this reach zero would be a second way to die
    // that went through neither.
    setHearts: (hearts: number) => {
      setRun((r) => ({ ...r, hearts: Math.max(1, Math.min(HEARTS, hearts)) }))
    },

    // Warriors made harmless, so a siege can be watched to the end rather than survived.
    // See `invincible` on the run for why this guards the warriors and nothing else.
    setInvincible: (invincible: boolean) => {
      setRun((r) => ({ ...r, invincible }))
    },

    // Satiety, set rather than spent — because reaching an empty bar honestly means
    // walking ten crossroads past every village on the way, and a check nobody can make
    // in under a minute is a check that stops being made.
    //
    // Not floored the way the hearts are, and that is the difference between the two: an
    // empty bar is not an ending. It arms the same clock a tenth crossroad would arm, and
    // the hearts go one at a time through the beats they already go through. Set by the
    // same `eat` every bite goes through, so the tool cannot reach a state the mode
    // cannot.
    setSatiety: (satiety: number) => {
      const now = Date.now()
      setRun((r) => ({ ...r, ...eat(r, Math.min(FULL, Math.max(0, satiety)), now) }))
    },

    // Every standing tower flattened, down the same road the last dialled hit takes:
    // `taken`, a heart back, the walls down, the hero walking in through the gate.
    raze: () => {
      const now = Date.now()
      setRun((r) => {
        if (r.phase !== 'siege' || r.siege === null) return r
        return {
          ...r,
          siege: {
            ...r.siege,
            towers: r.siege.towers.map((tower) => ({ ...tower, left: 0 })),
            warriors: [],
          },
          phase: 'taken',
          hearts: Math.min(HEARTS, r.hearts + 1),
          taken: r.taken + 1,
          ...beat(r, now),
        }
      })
    },
  }

  // What the sidebar is looking at. `__DEV__` is a constant the bundler folds, so a shipped
  // build drops both the effect and the import.
  //
  // No dependency array: every beat should republish, and the store does its own comparison
  // rather than making this one guess at which figures matter — see publishArcadeDev.
  useEffect(() => {
    if (!__DEV__) return
    publishArcadeDev({
      phase: run.phase,
      depth,
      hearts: run.hearts,
      satiety: run.satiety,
      invincible: run.invincible,
      canSiege: standing?.from != null && !run.paused && isOneOf(run.phase, DIALABLE),
      inSiege: run.phase === 'siege',
      actions: dev,
    })
  })

  // Cleared when the screen goes, so a sidebar left open after a run is closed says there
  // is nothing to drive rather than driving a run that has gone.
  useEffect(
    () => () => {
      if (__DEV__) publishArcadeDev(null)
    },
    [],
  )

  return {
    // The whole world is this number: the map is grown from it and so is the land. Read by
    // the screen rather than kept there, so there is one of it.
    seed: run.seed,
    phase: run.phase,
    grid: run.grid,
    depth,
    best: run.best,
    strikes: run.strikes,
    hearts: run.hearts,
    siege: run.siege,
    taken: run.taken,
    // How fed the hero is, and whether the hearts are going. Two readings rather than one
    // because the bar draws them differently: a fraction is a width, and starving is a
    // colour and a pulse.
    satiety: run.satiety,
    starving: starving(run.satiety),
    playedMs: run.playedMs,
    paused: run.paused,
    standing,
    behind: trail(run.map, run.at, TRAIL_DEPTH),
    // The crossroad a retreat would land on, which is also the frame the way in is drawn in.
    parent: parentId === null ? undefined : run.map[parentId],
    destination: destinationOf(),
    sight: sightOf(),
    // What the place at the end of a way is called. Asked of the run because the names are
    // on the map, and the map is what this hook holds.
    nameOf: (id: string) => run.map[id]?.name ?? '',
    // Whether the village at the end of a way has walls. Asked of the run for the same
    // reason the name is — the walls are on the map, and the map is what this hook holds —
    // and asked at all because a fan has to say which of its ways is a fight *before* one
    // of them is dialled.
    walledAt: (id: string) => run.map[id]?.fortified === true,
    moving: run.moving,
    through: run.through,
    // What the clock on the way behind has left to run, and the fraction of it already gone
    // — nought on a fresh crossroad, and wherever a pause left it on a resumed one.
    clockMs: Math.max(0, clockMs - run.heldMs),
    clockFrom: clockMs > 0 ? Math.min(1, run.heldMs / clockMs) : 0,
    seq: run.seq,
    // Whether the dial is listening. Off while the hero is moving: the answer has been
    // given, and a key pressed mid-walk would be answering a crossroad nobody is on.
    dialable: !run.paused && isOneOf(run.phase, DIALABLE),
    press: (index: number, delta: 1 | -1) => {
      applyMove((grid) => pressGrid(ARCADE_DIAL, grid, index, delta), Date.now())
    },
    set: (index: number, value: number) => {
      applyMove((grid) => setGrid(grid, index, value), Date.now())
    },
    pause: pauseRun,
    resume: () => {
      const now = Date.now()
      setRun((r) => {
        if (!r.paused) return r
        // How long the player was away. The beat starts again as far back as it had got,
        // so what is left of it is what was left of it when they stopped — and every clock
        // in a siege moves by exactly the same amount, so a warrior three quarters of the
        // way down still is.
        const away = now - r.heldMs - r.beatAt
        return {
          ...r,
          paused: false,
          beatAt: now - r.heldMs,
          playingSince: now,
          siege: r.siege === null ? null : shift(r.siege, away),
          // Hunger moves by exactly the same amount, so a hero four seconds from losing a
          // heart still is.
          starvingAt: r.starvingAt === null ? null : r.starvingAt + away,
        }
      })
    },
    restart: () => {
      setRun(startRun(freshSeed(), Date.now()))
    },
  }
}
