import { Text, View } from 'react-native'

import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { formatGameTime } from '@/lib/duration'

// The four numbers a run leaves behind, shown on both the pause and game-over
// screens. One component so the two can never drift apart.
//
// One line rather than a stacked table: four numbers are a footnote to the score,
// not a report, and read across in a row they cost a fraction of the height they used
// to. The row takes the full width and centres its content, so nothing can collapse
// it — that collapse is what once squeezed `AVG ACC` onto two lines.
export function RunStats({
  hits,
  gameTimeMs,
  avgAccuracy,
  avgSpeed,
  halo = false,
}: {
  hits: number
  // How long the run has been actively played — not counting time in the pause menu,
  // and frozen the instant this screen appears rather than ticking while it is open.
  gameTimeMs: number
  avgAccuracy: number
  avgSpeed: number
  // Set on the gold game-over screen, where these sit straight on the celebration.
  halo?: boolean
}) {
  const shadow = halo ? ON_GOLD_LABEL_SHADOW : null
  const cells = [
    { label: 'HITS', value: `${hits}` },
    { label: 'TIME', value: formatGameTime(gameTimeMs) },
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
