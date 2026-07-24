import { Text, View } from 'react-native'

import { cn } from '@/lib/cn'
import type { PlayerState } from '@/types/multiplayer'

export function RankRow({
  player,
  rank,
  userId,
}: {
  player: PlayerState
  rank: number
  userId: string | null
}) {
  const isMe = player.userId === userId
  return (
    <View className="flex-row items-center gap-3 py-1.5">
      <Text selectable={false} className="w-5 font-mono text-[10px] font-bold text-dim">
        {rank}.
      </Text>
      <Text
        selectable={false}
        className={cn(
          'flex-1 font-mono text-[11px] font-bold tracking-[1px]',
          isMe ? 'text-[#4C7EFF]' : 'text-[#D8D2F4]',
        )}
        numberOfLines={1}
      >
        {player.nickname}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[11px] font-black tracking-[1px] text-primary"
      >
        {player.score}
      </Text>
      {player.ready ? (
        <Text selectable={false} className="w-4 text-[12px]" style={{ color: '#4ADE80' }}>
          ✓
        </Text>
      ) : (
        <View className="w-4" />
      )}
    </View>
  )
}
