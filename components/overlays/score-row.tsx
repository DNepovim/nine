import { Text, View } from 'react-native'

import { cn } from '@/lib/cn'
import { rankEmoji } from '@/lib/rank-emoji'

export type ScoreEntry = {
  rank: number
  nickname: string
  score: number
  isUser?: boolean
  // Set on a local record that has not reached the board yet — the row says why.
  note?: string
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
  // Null past fifth — the player's own row can sit below the board's cut, and there
  // the number is the point.
  const emoji = rankEmoji(entry.rank)
  return (
    <View
      className="flex-row items-center rounded-lg px-2 py-1"
      style={highlight ? { backgroundColor: accentColor + '20' } : undefined}
    >
      {/* An emoji needs more room than the 10px numeral it replaces, and a fixed line
          height on both keeps a row the same height whichever it shows — the board's
          five rows would otherwise stand taller than the player's own row below the
          cut. */}
      <Text
        selectable={false}
        className={cn(
          'w-7 font-mono font-bold leading-[16px] text-dim',
          emoji === null ? 'text-[10px]' : 'text-[13px]',
        )}
        style={accentStyle}
      >
        {emoji ?? entry.rank}
      </Text>
      <View className="flex-1 flex-row items-baseline gap-1.5">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[0.5px] text-primary"
          style={accentStyle}
        >
          {entry.nickname}
        </Text>
        {entry.note !== undefined && (
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[7px] font-bold tracking-[0.5px] text-dim"
          >
            {entry.note}
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
