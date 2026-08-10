import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'

// Shown under the board while the player has unpublished local scores and no
// nickname — the one thing standing between those scores and the real leaderboard.
// The button carries the call to action; the reason sits under it, outside the pill,
// so the button itself stays as short as the mode gradients it borrows from.
export function PublishScoresButton({
  from,
  to,
  onPress,
}: {
  from: string
  to: string
  onPress: () => void
}) {
  return (
    <View className="mt-3 items-center">
      <Pressable onPress={onPress} hitSlop={8} className="overflow-hidden rounded-xl">
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          className="items-center px-5 py-2.5"
        >
          <Text
            selectable={false}
            className="font-mono text-[11px] font-black tracking-[2px] text-white"
          >
            ADD YOUR NICKNAME
          </Text>
        </LinearGradient>
      </Pressable>
      <Text
        selectable={false}
        className="mt-1.5 font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
        TO PUBLISH YOUR BESTS
      </Text>
    </View>
  )
}
