import { useCallback, useEffect, useRef, useState } from 'react'

import { computeSum, type Grid } from '@/machines/game'
import { accuracyFactor, computePar } from '@/machines/scoring'

const initialGrid: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

export function useMultiplayerDial({
  targetValue,
  onHit,
}: {
  targetValue: number | null
  onHit: (accuracy: number) => void
}) {
  const [grid, setGrid] = useState<Grid>(initialGrid)
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
      parRef.current = computePar(gridRef.current, targetValue)
      stepsRef.current = 0
    }
  }, [targetValue])

  const applyGrid = useCallback((newGrid: Grid) => {
    gridRef.current = newGrid
    setGrid(newGrid)
    stepsRef.current++

    const tv = targetRef.current
    if (tv !== null && computeSum(newGrid) === tv) {
      const accuracy = accuracyFactor(parRef.current, stepsRef.current)
      onHitRef.current(accuracy)
      // Reset so repeated accidental matches don't re-fire.
      parRef.current = 0
      stepsRef.current = 0
    }
  }, [])

  const handlePress = useCallback(
    (index: number, delta: 1 | -1) => {
      const row = Math.floor(index / 3)
      const col = index % 3
      const newGrid = gridRef.current.map((r, ri) =>
        r.map((v, ci) => {
          if (ri !== row || ci !== col) return v
          return (((v + delta) % 10) + 10) % 10
        }),
      ) as Grid
      applyGrid(newGrid)
    },
    [applyGrid],
  )

  const handleSet = useCallback(
    (index: number, value: number) => {
      const row = Math.floor(index / 3)
      const col = index % 3
      const newGrid = gridRef.current.map((r, ri) =>
        r.map((v, ci) => (ri === row && ci === col ? value : v)),
      ) as Grid
      applyGrid(newGrid)
    },
    [applyGrid],
  )

  return { grid, handlePress, handleSet }
}
