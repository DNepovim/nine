import { Ionicons } from '@expo/vector-icons'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Pressable, Text } from 'react-native'

import { achievement, ACHIEVEMENT_COUNT } from '@/constants/achievements'
import type { AchievementId } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'

// What the line wears before there is anything to show. The trophy and the feature's
// own name, so the front door is still labelled for the player who has not found it —
// and the same shape as the filled state, so nothing jumps when the first one lands.
const EMPTY_EMBLEM = '🏆'
const EMPTY_TITLE = msg`ACHIEVEMENTS`

// The last thing the player achieved, how far through the catalogue that is, and the way
// in to the rest of it.
//
// The latest rather than a progress strip: ten segments said only how far along you
// were, where the emblem and the title say what you actually did. The count carries the
// progress on its own.
//
// Never silent, unlike the medal line above it. A medal line with nothing in it is a
// player who has not won anything; this line with nothing in it is a player who has not
// found the feature, and hiding the front door from exactly them is backwards.
export function AchievementProgress({
  earned,
  latest,
  onPress,
}: {
  earned: number
  // The most recently achieved one, or null before there is one. Resolved by the
  // caller — see `latestAchievement`.
  latest: AchievementId | null
  onPress: () => void
}) {
  const { colorScheme } = useTheme()
  const { t } = useLingui()
  const ink = ACHIEVEMENT_INK[colorScheme]
  const def = latest === null ? null : achievement(latest)

  return (
    <Pressable onPress={onPress} hitSlop={8} className="mb-4 flex-row items-center gap-2">
      <Text selectable={false} className="text-[13px] leading-[16px]">
        {def?.emblem ?? EMPTY_EMBLEM}
      </Text>
      <Text
        selectable={false}
        numberOfLines={1}
        className="font-mono text-[9px] font-black tracking-[1px]"
        style={{ color: def === null ? undefined : ink }}
      >
        {def === null ? t(EMPTY_TITLE) : t(def.title)}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[9px] font-black tracking-[1px] text-dim"
      >
        {earned}/{ACHIEVEMENT_COUNT}
      </Text>
      <Ionicons name="chevron-forward" size={10} color={ink} />
    </Pressable>
  )
}
