import { useSyncExternalStore } from 'react'

import { AZULEJO } from '@/constants/colors'

// The one grid of tiles a run on the azulejo panel is drawn on: the wall behind the run, the keys
// and the targets are all tiles of it. It is the **dial's** — the keys are laid first and
// everything else is cut to their pitch and lined up with them — so the dial reports where it
// stands, in window coordinates, and the wall and the targets read it from here.
//
// A store of its own rather than a context because the reporter, the wall behind the screen and
// the targets in the middle of it share no provider, and what they share is one fact about one
// screen. The ink is the other half: the challenge's colour, which the tiles are painted in.
export type TileGrid = { x: number; y: number; size: number }

let grid: TileGrid | null = null
let ink: string = AZULEJO.cobalt
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const notify = () => {
  for (const listener of listeners) listener()
}

export function reportTileGrid(next: TileGrid | null) {
  const same =
    grid === next ||
    (grid !== null &&
      next !== null &&
      grid.x === next.x &&
      grid.y === next.y &&
      grid.size === next.size)
  if (same) return
  grid = next
  notify()
}

export function setTileInk(next: string | null) {
  const value = next ?? AZULEJO.cobalt
  if (value === ink) return
  ink = value
  notify()
}

export const useTileGrid = (): TileGrid | null =>
  useSyncExternalStore(
    subscribe,
    () => grid,
    () => null,
  )

export const useTileInk = (): string =>
  useSyncExternalStore(
    subscribe,
    () => ink,
    () => AZULEJO.cobalt,
  )
