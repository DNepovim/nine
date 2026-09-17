import { isNonEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import { ACHIEVEMENTS, type AchievementId } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'

// What this run earned for good, under the numbers that only describe it.
//
// Silent on an ordinary run, which is most of them — a row that appeared on every game
// over would stop meaning anything by the third one.
//
// The green gives way on the painted screens. `GOLD_SCREEN_TOKENS` and
// `MODE_SCREEN_TOKENS` re-bind every token for that subtree and a colour computed in JS
// cannot see them, so there the chips take the screen's own ink and the halo that lifts
// it off the celebration — the same trade `GOLD_DIM_INK` makes for the HOME icon.
export function EarnedAchievements({
  ids,
  halo = false,
}: {
  ids: readonly AchievementId[]
  // Set on the gold and mode-painted game-over screens.
  halo?: boolean
}) {
  const { colorScheme } = useTheme()
  if (!isNonEmptyArray(ids)) return null

  const shadow = halo ? ON_GOLD_LABEL_SHADOW : null

  return (
    <View className="mb-6 w-full flex-row flex-wrap items-center justify-center gap-1.5">
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold tracking-[1.5px] text-dim"
        style={shadow}
      >
        EARNED
      </Text>
      {ids.map((id) => (
        <View
          key={id}
          className="flex-row items-center gap-1 rounded-full bg-card px-2 py-1"
        >
          <Text selectable={false} className="text-[10px] leading-[13px]">
            {ACHIEVEMENTS[id].emblem}
          </Text>
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[9px] font-black leading-[13px] tracking-[1px]"
            // The chip sits on its own surface, so the halo is only for the label
            // outside it — inside, the ink just has to suit the card.
            style={halo ? null : { color: ACHIEVEMENT_INK[colorScheme] }}
          >
            {ACHIEVEMENTS[id].title}
          </Text>
        </View>
      ))}
    </View>
  )
}
