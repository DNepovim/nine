import { useCallback, useEffect, useRef, useState } from 'react'

import { accuracyFactor, computePar } from '@/machines/scoring'
import { emptyGrid, NINE_DIAL, pressGrid, setGrid, sumOf, type Grid } from '@/modes'

// A shared run is one of the two scored modes on the dial everyone knows, so the board
// is named here rather than resolved from the room's mode.
const BOARD = NINE_DIAL

const initialGrid: Grid = emptyGrid(BOARD)

export function useMultiplayerDial({
  targetValue,
  onHit,
}: {
  targetValue: number | null
  onHit: (accuracy: number) => void
}) {
  const [grid, setDial] = useState<Grid>(initialGrid)
  const parRef = useRef(0)
  const stepsRef = useRef(0)
  const gridRef = useRef<Grid>(initialGrid)
  const targetRef = useRef<number | null>(null)
  const onHitRef = useRef(onHit)

  useEffect(() => {
    onHitRef.current = onHit
  }, [onHit])

  // Recompute par and reset steps when target changes.
  useEffect(() => {
    targetRef.current = targetValue
    if (targetValue !== null) {
      parRef.current = computePar(BOARD, gridRef.current, targetValue)
      stepsRef.current = 0
    }
  }, [targetValue])

  const applyGrid = useCallback((newGrid: Grid) => {
    gridRef.current = newGrid
    setDial(newGrid)
    stepsRef.current++

    const tv = targetRef.current
    if (tv !== null && sumOf(BOARD, newGrid) === tv) {
      const accuracy = accuracyFactor(parRef.current, stepsRef.current)
      onHitRef.current(accuracy)
      // Reset so repeated accidental matches don't re-fire.
      parRef.current = 0
      stepsRef.current = 0
    }
  }, [])

  const handlePress = useCallback(
    (index: number, delta: 1 | -1) => {
      applyGrid(pressGrid(BOARD, gridRef.current, index, delta))
    },
    [applyGrid],
  )

  const handleSet = useCallback(
    (index: number, value: number) => {
      applyGrid(setGrid(gridRef.current, index, value))
    },
    [applyGrid],
  )

  return { grid, handlePress, handleSet }
}
