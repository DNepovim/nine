import { useState } from 'react'
import { View } from 'react-native'

import { DialButton } from '@/components/game/dial-button'
import { ThumbHint, type ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'
import { useGameDialSize } from '@/hooks/use-game-dial-size'
import { cellWeight, GRID_SIZE } from '@/lib/tutorial-grid'

// The real dial, sized to whatever space the lesson gives it, with an optional
// thumb hint sitting over one cell.
export function LiveDialGrid({
  cells,
  isDark,
  showWeights,
  hintCell,
  hintGesture,
  hintColor,
  onDelta,
  onSet,
}: {
  cells: readonly number[]
  isDark: boolean
  showWeights: boolean
  hintCell: number | null
  hintGesture: ThumbGesture
  hintColor: string
  onDelta: (index: number, delta: 1 | -1) => void
  onSet: (index: number, value: number) => void
}) {
  const [measured, setMeasured] = useState(0)
  const size = useGameDialSize(measured)
  const cellSize = Math.floor(size / GRID_SIZE)

  return (
    // Bottom-aligned and sized like the game's dial pad, so the grid lands where
    // the player will find it later.
    <View
      className="flex-1 items-center justify-end"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        setMeasured(Math.min(width, height))
      }}
    >
      <View style={{ width: size, height: size }} className="flex-row flex-wrap">
        {cells.map((value, index) => (
          <DialButton
            key={index}
            value={value}
            isDark={isDark}
            size={cellSize}
            weight={cellWeight(index)}
            showSum={false}
            trainee={showWeights}
            onDelta={(delta) => {
              onDelta(index, delta)
            }}
            onSet={(next) => {
              onSet(index, next)
            }}
          />
        ))}

        {hintCell !== null && cellSize > 0 && (
          <View
            pointerEvents="none"
            className="absolute items-center justify-center"
            style={{
              left: (hintCell % GRID_SIZE) * cellSize,
              top: Math.floor(hintCell / GRID_SIZE) * cellSize,
              width: cellSize,
              height: cellSize,
            }}
          >
            <ThumbHint
              gesture={hintGesture}
              color={hintColor}
              size={Math.round(cellSize * 0.8)}
            />
          </View>
        )}
      </View>
    </View>
  )
}
