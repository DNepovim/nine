import { Text, View } from 'react-native'

import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'

// The three numbers a run leaves behind, shown on both the pause and game-over
// screens. One component so the two can never drift apart.
//
// One line rather than a stacked table: three numbers are a footnote to the score,
// not a report, and read across in a row they cost a sixth of the height they used to.
// The row takes the full width and centres its content, so nothing can collapse it —
// that collapse is what once squeezed `AVG ACC` onto two lines.
export function RunStats({
  hits,
  avgAccuracy,
  avgSpeed,
  halo = false,
}: {
  hits: number
  avgAccuracy: number
  avgSpeed: number
  // Set on the gold game-over screen, where these sit straight on the celebration.
  halo?: boolean
}) {
  const shadow = halo ? ON_GOLD_LABEL_SHADOW : null
  const cells = [
    { label: 'HITS', value: `${hits}` },
    { label: 'AVG ACC', value: `${avgAccuracy}%` },
    { label: 'AVG SPD', value: `${avgSpeed}%` },
  ]

  return (
    <View className="mb-6 w-full flex-row items-baseline justify-center gap-3">
      {cells.map(({ label, value }) => (
        <View key={label} className="flex-row items-baseline gap-1">
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[12px] font-bold tracking-[0.5px] text-primary"
            style={shadow}
          >
            {value}
          </Text>
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
            style={shadow}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  )
}
