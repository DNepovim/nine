import { Text, View } from 'react-native'

import { cn } from '@/lib/cn'

const CELL = 32

// A static, non-interactive 3×3 board for illustrations. Highlighted cells carry
// the accent; the rest fade back.
export function MiniGrid({
  cells,
  highlight,
  color,
}: {
  cells: readonly number[]
  highlight: readonly number[]
  color: string
}) {
  return (
    <View className="flex-row flex-wrap" style={{ width: CELL * 3 }}>
      {cells.map((value, index) => {
        const lit = highlight.includes(index)
        return (
          <View key={index} className="p-1" style={{ width: CELL, height: CELL }}>
            <View
              className={cn(
                'flex-1 items-center justify-center rounded-full',
                !lit && 'bg-muted',
              )}
              style={lit ? { backgroundColor: color } : null}
            >
              <Text
                selectable={false}
                className={cn(
                  'font-mono text-[12px] font-bold',
                  lit ? 'text-white' : 'text-dim',
                )}
              >
                {value}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}
