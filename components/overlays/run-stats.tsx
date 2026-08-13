import { Text, View } from 'react-native'

// The three numbers a run leaves behind, shown on both the pause and game-over
// screens. One component so the two can never drift apart.
//
// Labels right-aligned, values left-aligned, the boundary at the screen centre — the
// row takes the full width rather than sizing to its content, which is what used to
// squeeze `AVG ACC` onto two lines: inside a centred column a width-less flex row
// collapses to its content and takes its flex-1 children down with it.
export function RunStats({
  hits,
  avgAccuracy,
  avgSpeed,
}: {
  hits: number
  avgAccuracy: number
  avgSpeed: number
}) {
  const rows = [
    { label: 'HITS', value: `${hits}` },
    { label: 'AVG ACC', value: `${avgAccuracy}%` },
    { label: 'AVG SPD', value: `${avgSpeed}%` },
  ]

  return (
    <View className="mb-6 w-full flex-row">
      <View className="flex-1 items-end gap-2 pr-4">
        {rows.map(({ label }) => (
          <Text
            key={label}
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[10px] font-bold tracking-[1.5px] text-dim"
          >
            {label}
          </Text>
        ))}
      </View>
      <View className="flex-1 items-start gap-2 pl-4">
        {rows.map(({ label, value }) => (
          <Text
            key={label}
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[10px] font-bold tracking-[1.5px] text-primary"
          >
            {value}
          </Text>
        ))}
      </View>
    </View>
  )
}
