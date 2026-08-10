import { Text, View } from 'react-native'

// The cell weights, row-major: value × (row+1) × (col+1). Mirrors computeSum.
const WEIGHTS = [
  [1, 2, 3],
  [2, 4, 6],
  [3, 6, 9],
]

const ORDER = ['1', '2', '3']

// The 3×3 grid of cell weights with row / column order headers, so it reads as
// weight = row order × column order (bottom-right ×9 is the coarsest knob).
export function WeightGrid() {
  return (
    <View className="items-center">
      {/* Column-order headers (left-padded to clear the row-header column). */}
      <View className="mb-2 flex-row items-center gap-2">
        <View className="w-12 items-center">
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[0.5px] text-dim"
          >
            R×C
          </Text>
        </View>
        {ORDER.map((n) => (
          <View key={n} className="w-14 items-center">
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[0.5px] text-dim"
            >
              {`COL ${n}`}
            </Text>
          </View>
        ))}
      </View>

      {WEIGHTS.map((row, r) => (
        <View key={r} className="mb-2 flex-row items-center gap-2">
          <View className="w-12 items-center">
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[0.5px] text-dim"
            >
              {`ROW ${ORDER[r] ?? ''}`}
            </Text>
          </View>
          {row.map((w, c) => {
            const t = w / 9
            return (
              <View
                key={c}
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: `rgba(114,115,210,${0.14 + t * 0.6})` }}
              >
                <Text
                  selectable={false}
                  className="font-mono text-[16px] font-black"
                  style={{ color: t > 0.55 ? '#FFFFFF' : '#3A3760' }}
                >
                  {w}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
      <Text
        selectable={false}
        className="mt-1 font-mono text-[10px] font-bold tracking-[1px] text-dim"
      >
        WEIGHT = ROW ORDER × COLUMN ORDER
      </Text>
    </View>
  )
}
