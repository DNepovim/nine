import { isOneOf } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import {
  BLOOM_MS,
  DAWN_MS,
  FALL_MS,
  RETREAT_MS,
  ROCKET_MS,
  TRAIL_DEPTH,
  WALK_MS,
} from '@/constants/arcade'
import {
  crossroadClock,
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
import { buildPressGrid, buildSetGrid, computeSum, type Grid } from '@/machines/game'

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
export type ArcadePhase =
  'dawn' | 'bloom' | 'open' | 'walk' | 'rocket' | 'retreat' | 'falling' | 'over'

const DIALABLE: readonly ArcadePhase[] = ['bloom', 'open']

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
} as const satisfies Partial<Record<ArcadePhase, number>>

const INITIAL_GRID: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

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

const freshSeed = (): number => Math.floor(Math.random() * 0x7fffffff)

export function useArcadeRun() {
  const [run, setRun] = useState<Run>(() => startRun(freshSeed(), Date.now()))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const standing: Crossroad | undefined = run.map[run.at]
  const depth = standing?.depth ?? 0
  const clockMs = crossroadClock(depth)

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
    // stub into the mouth, which is the only way a run ends.
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
          // The fan at the far end is grown now rather than when the way was offered, so it
          // is measured against the grid the player arrives holding.
          const map = openCrossroad(r.map, way.to, r.grid, r.seed)
          const landed = map[way.to]?.depth ?? 0
          return {
            ...r,
            map,
            at: way.to,
            phase: 'bloom',
            moving: null,
            best: Math.max(r.best, landed),
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
          const map = openCrossroad(r.map, through.to, r.grid, r.seed)
          const landed = map[through.to]?.depth ?? 0
          return {
            ...r,
            map,
            at: through.to,
            phase: 'bloom',
            moving: null,
            through: null,
            best: Math.max(r.best, landed),
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
          return { ...r, at: back, phase: 'bloom', moving: null, ...beat(r, now) }
        })
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
      const sum = computeSum(next)
      const taken = r.map[r.at]?.ways.find((way) => way.value === sum)
      if (taken === undefined) return { ...r, grid: next }

      // Fast enough to be a strike? The clock this crossroad was given, less what has run
      // off it — and all of it still full while the fan was blooming, which is the head
      // start a player quick enough to answer before the clock starts has earned.
      const answered = crossroadClock(r.map[r.at]?.depth ?? 0)
      const leftMs = r.phase === 'open' ? answered - (now - r.beatAt) : answered
      if (!isStrike(leftMs, answered)) {
        return { ...r, grid: next, phase: 'walk', moving: taken, ...beat(r, now) }
      }

      // A strike. The crossroad the hero is about to pass through is opened here rather
      // than on arrival, because the way *out* of it has to be a way the map already has:
      // the rocket is taking it, and nothing may be rolled mid-flight. It opens against
      // the same grid an arrival would have opened it with, so the fan is the same fan
      // either way.
      const map = openCrossroad(r.map, taken.to, next, r.seed)
      const through = straightestWay(map[taken.to])
      if (through === null) {
        return { ...r, grid: next, phase: 'walk', moving: taken, ...beat(r, now) }
      }
      return {
        ...r,
        grid: next,
        map,
        phase: 'rocket',
        moving: taken,
        through,
        strikes: r.strikes + 1,
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

  return {
    // The whole world is this number: the map is grown from it and so is the land. Read by
    // the screen rather than kept there, so there is one of it.
    seed: run.seed,
    phase: run.phase,
    grid: run.grid,
    depth,
    best: run.best,
    strikes: run.strikes,
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
      applyMove((grid) => buildPressGrid(grid, index, delta), Date.now())
    },
    set: (index: number, value: number) => {
      applyMove((grid) => buildSetGrid(grid, index, value), Date.now())
    },
    pause: () => {
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
    },
    resume: () => {
      const now = Date.now()
      setRun((r) =>
        r.paused
          ? // The beat starts again as far back as it had got, so what is left of it is what
            // was left of it when the player stopped.
            { ...r, paused: false, beatAt: now - r.heldMs, playingSince: now }
          : r,
      )
    },
    restart: () => {
      setRun(startRun(freshSeed(), Date.now()))
    },
  }
}
