import { isOneOf } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import { BLOOM_MS, FALL_MS, RETREAT_MS, TRAIL_DEPTH, WALK_MS } from '@/constants/arcade'
import {
  crossroadClock,
  newMap,
  openCrossroad,
  rngFor,
  START,
  trail,
  wayInto,
  type ArcadeMap,
  type ArcadeWay,
  type Crossroad,
} from '@/machines/arcade'
import { buildPressGrid, buildSetGrid, computeSum, type Grid } from '@/machines/game'
import type { Difficulty } from '@/machines/modes'

// One arcade run: where the hero stands, what the crossroad offers, and the clock that
// drags it back down. The rules it leans on are in machines/arcade.ts; what is here is the
// part that needs a clock and a render.
//
// Not the game machine. A run of this scores no points, keeps no lives and writes to no
// board, so there was nothing for it to borrow but the grid — which it does, through the
// same two builders every press in the app goes through.

// The beats a run moves through. `bloom` and `open` are both dialable: the clock only
// starts once the fan is drawn, and a player quick enough to answer before it does has
// earned the head start.
export type ArcadePhase = 'bloom' | 'open' | 'walk' | 'retreat' | 'falling' | 'over'

const DIALABLE: readonly ArcadePhase[] = ['bloom', 'open']

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
  // Bumped on every beat, so an effect that has to restart a clock or an animation can tell
  // a new crossroad from a re-render of the one before it.
  seq: number
}

const startRun = (seed: number): Run => ({
  seed,
  map: openCrossroad(newMap(), START, INITIAL_GRID, rngFor(seed, START)),
  at: START,
  phase: 'bloom',
  grid: INITIAL_GRID,
  best: 0,
  moving: null,
  seq: 1,
})

const freshSeed = (): number => Math.floor(Math.random() * 0x7fffffff)

export function useArcadeRun(difficulty: Difficulty) {
  const [run, setRun] = useState<Run>(() => startRun(freshSeed()))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const standing: Crossroad | undefined = run.map[run.at]
  const depth = standing?.depth ?? 0
  const clockMs = crossroadClock(depth, difficulty)

  // What ends each beat. One timer rather than one per phase, cleared by the effect that
  // set it — a press can end `open` early, and the clock it was running has to go with it.
  useEffect(() => {
    const after = (ms: number, step: () => void) => {
      timer.current = setTimeout(step, ms)
    }

    if (run.phase === 'bloom') {
      after(BLOOM_MS, () => {
        setRun((r) => (r.phase === 'bloom' ? { ...r, phase: 'open' } : r))
      })
    }

    // The clock ran out. One crossroad back — or, with none behind to go back to, down the
    // stub into the mouth, which is the only way a run ends.
    if (run.phase === 'open') {
      after(clockMs, () => {
        setRun((r) => {
          if (r.phase !== 'open') return r
          const here = r.map[r.at]
          if (here?.from == null) {
            return { ...r, phase: 'falling', moving: null, seq: r.seq + 1 }
          }
          return { ...r, phase: 'retreat', moving: wayInto(r.map, r.at), seq: r.seq + 1 }
        })
      })
    }

    if (run.phase === 'walk') {
      after(WALK_MS, () => {
        setRun((r) => {
          const way = r.moving
          if (r.phase !== 'walk' || way === null) return r
          // The fan at the far end is grown now rather than when the way was offered, so it
          // is measured against the grid the player arrives holding.
          const map = openCrossroad(r.map, way.to, r.grid, rngFor(r.seed, way.to))
          const landed = map[way.to]?.depth ?? 0
          return {
            ...r,
            map,
            at: way.to,
            phase: 'bloom',
            moving: null,
            best: Math.max(r.best, landed),
            seq: r.seq + 1,
          }
        })
      })
    }

    if (run.phase === 'retreat') {
      after(RETREAT_MS, () => {
        setRun((r) => {
          const back = r.map[r.at]?.from
          if (r.phase !== 'retreat' || back === undefined || back === null) return r
          // No map change: the crossroad behind keeps the fan it was grown with, so the ways
          // the hero comes back to are the ones it left — including the one it just failed
          // at, which is still a way.
          return { ...r, at: back, phase: 'bloom', moving: null, seq: r.seq + 1 }
        })
      })
    }

    if (run.phase === 'falling') {
      after(FALL_MS, () => {
        setRun((r) => (r.phase === 'falling' ? { ...r, phase: 'over' } : r))
      })
    }

    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
  }, [run.phase, run.seq, clockMs])

  // A press, by way of the same two builders the game machine presses through — so a key
  // behaves here exactly as it does in a run of Accuracy.
  //
  // The grid is built *inside* the update rather than handed in already built, because one
  // drag across the dial is several presses in one tick: a move measured against the grid
  // this render closed over would answer for the key before last and drop the rest.
  const applyMove = (build: (grid: Grid) => Grid) => {
    setRun((r) => {
      if (!isOneOf(r.phase, DIALABLE)) return r
      const next = build(r.grid)
      const sum = computeSum(next)
      const taken = r.map[r.at]?.ways.find((way) => way.value === sum)
      if (taken === undefined) return { ...r, grid: next }
      return { ...r, grid: next, phase: 'walk', moving: taken }
    })
  }

  const parentId = standing?.from ?? null

  // Where the movement in flight ends, which is what the canvas follows. Asked of the run
  // rather than worked out by the screen, because only this hook holds the map.
  const destinationOf = (): Crossroad | undefined => {
    if (run.phase === 'walk' && run.moving !== null) return run.map[run.moving.to]
    if (run.phase === 'retreat' && parentId !== null) return run.map[parentId]
    return standing
  }

  return {
    phase: run.phase,
    grid: run.grid,
    depth,
    best: run.best,
    standing,
    behind: trail(run.map, run.at, TRAIL_DEPTH),
    // The crossroad a retreat would land on, which is also the frame the way in is drawn in.
    parent: parentId === null ? undefined : run.map[parentId],
    destination: destinationOf(),
    moving: run.moving,
    clockMs,
    seq: run.seq,
    // Whether the dial is listening. Off while the hero is moving: the answer has been
    // given, and a key pressed mid-walk would be answering a crossroad nobody is on.
    dialable: isOneOf(run.phase, DIALABLE),
    press: (index: number, delta: 1 | -1) => {
      applyMove((grid) => buildPressGrid(grid, index, delta))
    },
    set: (index: number, value: number) => {
      applyMove((grid) => buildSetGrid(grid, index, value))
    },
    restart: () => {
      setRun(startRun(freshSeed()))
    },
  }
}
