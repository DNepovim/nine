import { Text, View } from 'react-native'

export type ScoreEntry = {
  rank: number
  nickname: string
  score: number
  isUser?: boolean
  // A local best that has not reached the board yet — says so in the row itself.
  unpublished?: boolean
}

export function ScoreRow({
  entry,
  accentColor,
}: {
  entry: ScoreEntry
  accentColor: string
}) {
  const highlight = entry.isUser === true
  const accentStyle = highlight ? { color: accentColor } : undefined
  return (
    <View
      className="flex-row items-center rounded-lg px-2 py-1.5"
      style={highlight ? { backgroundColor: accentColor + '20' } : undefined}
    >
      <Text
        selectable={false}
        className="w-7 font-mono text-[10px] font-bold text-dim"
        style={accentStyle}
      >
        {entry.rank}
      </Text>
      <View className="flex-1 flex-row items-baseline gap-1.5">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[0.5px] text-primary"
          style={accentStyle}
        >
          {entry.nickname}
        </Text>
        {entry.unpublished === true && (
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[7px] font-bold tracking-[0.5px] text-dim"
          >
            NOT PUBLISHED
          </Text>
        )}
      </View>
      <Text
        selectable={false}
        className="font-mono text-[10px] font-bold text-primary"
        style={accentStyle}
      >
        {entry.score}
      </Text>
    </View>
  )
}
