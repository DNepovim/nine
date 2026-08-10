import { View } from 'react-native'

import { DialButton } from '@/components/game/dial-button'
import { ThumbHint, type ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'
import { cellWeight, GRID_SIZE } from '@/lib/tutorial-grid'

// The real dial at the real size, with an optional thumb hint over one cell.
// Lessons that only accept one specific move simply ignore the rest in their
// handlers — every button still animates, it just doesn't change anything.
export function LiveDialGrid({
  cells,
  isDark,
  size,
  showWeights,
  showMax = true,
  hintCell,
  hintGesture,
  hintColor,
  onDelta,
  onSet,
}: {
  cells: readonly number[]
  isDark: boolean
  size: number
  showWeights: boolean
  showMax?: boolean
  hintCell: number | null
  hintGesture: ThumbGesture
  hintColor: string
  onDelta: (index: number, delta: 1 | -1) => void
  onSet: (index: number, value: number) => void
}) {
  const cellSize = Math.floor(size / GRID_SIZE)
  if (cellSize <= 0) return null

  return (
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
          showMax={showMax}
          onDelta={(delta) => {
            onDelta(index, delta)
          }}
          onSet={(next) => {
            onSet(index, next)
          }}
        />
      ))}

      {hintCell !== null && (
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
            size={Math.round(cellSize * 0.7)}
          />
        </View>
      )}
    </View>
  )
}
