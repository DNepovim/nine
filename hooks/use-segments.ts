import { useState } from 'react'

import {
  dropPending,
  EMPTY_DRAWING,
  plotPoint,
  type Drawing,
  type SegmentPoint,
} from '@/lib/segments'
import type { Grid } from '@/modes'

const sameGrid = (a: Grid, b: Grid): boolean =>
  a.length === b.length && a.every((digit, index) => digit === b[index])

// The segments drawn on a drafting board's targets area — see lib/segments.ts. A run starts on
// a clean sheet, and pressing a key takes back the segment waiting for its second tap: both are
// read off what the screen already knows, the run's id and the dial's digits, so nothing has to
// tell this hook that either happened.
//
// Worked out while rendering rather than in an effect, so the frame after a press never draws the
// half-made segment it has just lost.
export function useSegments(runId: string, grid: Grid) {
  const [held, setHeld] = useState({ runId, grid, drawing: EMPTY_DRAWING })

  let current = held
  if (held.runId !== runId) {
    current = { runId, grid, drawing: EMPTY_DRAWING }
  } else if (!sameGrid(held.grid, grid)) {
    current = { ...held, grid, drawing: dropPending(held.drawing) }
  }
  if (current !== held) setHeld(current)

  const plot = (point: SegmentPoint) => {
    setHeld((was) => ({ ...was, drawing: plotPoint(was.drawing, point) }))
  }

  return { drawing: current.drawing satisfies Drawing, plot }
}
