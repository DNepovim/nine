import { Text, View } from 'react-native'

import type { RoomPlayer } from '@/types/multiplayer'

export function PlayerSlot({
  player,
  index,
  color,
  isMe,
}: {
  player: RoomPlayer | undefined
  index: number
  color: string
  isMe: boolean
}) {
  return (
    <View
      className="flex-row items-center rounded-lg px-2 py-1.5"
      style={isMe && player ? { backgroundColor: color + '20' } : undefined}
    >
      <Text selectable={false} className="w-7 font-mono text-[10px] font-bold text-dim">
        {index + 1}.
      </Text>
      <Text
        selectable={false}
        className="flex-1 font-mono text-[10px] font-bold tracking-[0.5px]"
        style={{ color: player ? color : '#aaa69e30' }}
        numberOfLines={1}
      >
        {player ? player.nickname : `PLAYER ${index + 1}`}
      </Text>
    </View>
  )
}
