import { View } from 'react-native'

import { DialButton } from '@/components/game/dial-button'
import { ThumbHint, type ThumbGesture } from '@/components/overlays/tutorial/thumb-hint'
import { useDialMetrics } from '@/hooks/use-dial-metrics'
import { cellWeight, GRID_SIZE } from '@/lib/tutorial-grid'
import { DARK_MODE_GRADIENT } from '@/machines/modes'

// The hit flash a key wears when it lands on 9. Trainee's, because that is the run the
// tutorial's last screen drops the player into — the dial they learn on is the dial
// they get.
const [PEAK_FROM, PEAK_TO] = DARK_MODE_GRADIENT.trainee

// The real dial at the real size, with an optional thumb hint over one cell.
// Lessons that only accept one specific move simply ignore the rest in their
// handlers — every button still animates, it just doesn't change anything.
export function LiveDialGrid({
  cells,
  isDark,
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
  showWeights: boolean
  showMax?: boolean
  hintCell: number | null
  hintGesture: ThumbGesture
  hintColor: string
  onDelta: (index: number, delta: 1 | -1) => void
  onSet: (index: number, value: number) => void
}) {
  // Asked for here rather than passed in: this is the real dial, so it takes the same
  // number the game does instead of whatever a lesson thought to hand it.
  const { button: cellSize, gap, size } = useDialMetrics()
  if (cellSize <= 0) return null

  return (
    <View style={{ width: size, height: size, gap }} className="flex-row flex-wrap">
      {cells.map((value, index) => (
        <DialButton
          key={index}
          value={value}
          isDark={isDark}
          size={cellSize}
          weight={cellWeight(index)}
          peakFrom={PEAK_FROM}
          peakTo={PEAK_TO}
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
            // The gaps sit between cells, so a cell's offset carries one per column
            // or row already passed.
            left: (hintCell % GRID_SIZE) * (cellSize + gap),
            top: Math.floor(hintCell / GRID_SIZE) * (cellSize + gap),
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
