import { useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'

import { findPosition } from '@/lib/find-position'
import { type Target } from '@/machines/game'
import type { DisplayTarget } from '@/types/game'

// Mirrors the machine's targets into a display list that outlives removals long
// enough to play exit animations, assigns each new target a non-overlapping
// position, and clears the list when a fresh game starts.
export function useDisplayedTargets({
  machineTargets,
  isPlaying,
  stateValue,
}: {
  machineTargets: Target[]
  isPlaying: boolean
  stateValue: string
}) {
  const [displayedTargets, setDisplayedTargets] = useState<DisplayTarget[]>([])
  const containerSize = useRef({ width: 0, height: 0 })

  useEffect(() => {
    const machineIds = new Set(machineTargets.map((t) => t.id))
    setDisplayedTargets((prev) => {
      const updated = prev.map((t) => ({
        ...t,
        exiting: t.exiting || !machineIds.has(t.id),
      }))
      const displayedIds = new Set(prev.map((t) => t.id))
      const placed = [...updated]
      const incoming = machineTargets
        .filter((t) => !displayedIds.has(t.id))
        .map((t) => {
          const position = findPosition(
            placed,
            containerSize.current.width,
            containerSize.current.height,
          )
          const entry: DisplayTarget = { ...t, exiting: false, position }
          placed.push(entry)
          return entry
        })
      return [...updated, ...incoming]
    })
  }, [machineTargets])

  // Clear displayed targets when starting a fresh game.
  const prevStateRef = useRef(stateValue)
  useEffect(() => {
    const prev = prevStateRef.current
    const wasMenuOrGameOver = prev === 'menu' || prev === 'gameOver'
    if (wasMenuOrGameOver && isPlaying) setDisplayedTargets([])
    prevStateRef.current = stateValue
  }, [stateValue, isPlaying])

  const removeDisplayed = (id: number) => {
    setDisplayedTargets((prev) => prev.filter((t) => t.id !== id))
  }

  const onContainerLayout = (event: LayoutChangeEvent) => {
    containerSize.current = {
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    }
  }

  return { displayedTargets, removeDisplayed, onContainerLayout }
}
