import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'

import { ACHIEVEMENT_COUNT } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'

// The strip is ten segments however long the catalogue grows, so adding an achievement
// never changes the shape of the thing on the intro screen.
const SEGMENTS = 10

// How far through the catalogue the player is, and the way in to the rest of it.
//
// Never silent, unlike the medal line above it. A medal line with nothing in it is a
// player who has not won anything; a strip with nothing in it is a player who has not
// found the feature, and hiding the front door from exactly them is backwards.
export function AchievementProgress({
  earned,
  onPress,
}: {
  earned: number
  onPress: () => void
}) {
  const { colorScheme } = useTheme()
  const ink = ACHIEVEMENT_INK[colorScheme]
  // Round down, so the last segment means "all of them" rather than "nearly".
  const filled = Math.floor((SEGMENTS * earned) / ACHIEVEMENT_COUNT)

  return (
    <Pressable onPress={onPress} hitSlop={8} className="mb-4 flex-row items-center gap-2">
      <View className="flex-row gap-[3px]">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View
            key={i}
            className="h-[6px] w-[10px] rounded-[1px] bg-elevated"
            style={i < filled ? { backgroundColor: ink } : null}
          />
        ))}
      </View>
      <Text
        selectable={false}
        className="font-mono text-[9px] font-black tracking-[1px] text-dim"
      >
        {earned}/{ACHIEVEMENT_COUNT} ACHIEVEMENTS
      </Text>
      <Ionicons name="chevron-forward" size={10} color={ink} />
    </Pressable>
  )
}
