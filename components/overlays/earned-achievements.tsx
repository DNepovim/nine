import { useLingui } from '@lingui/react/macro'
import { isNonEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import { ACHIEVEMENTS } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { awardKey, type Award } from '@/lib/achievements'
import { DIFFICULTIES } from '@/machines/modes'

// What this run achieved for good, under the numbers that only describe it.
//
// No heading over them. A chip is an emblem and a name — it already says what it is, and
// a word above a row that only ever holds achievements was labelling the obvious.
//
// Silent on an ordinary run, which is most of them — a row that appeared on every game
// over would stop meaning anything by the third one.
//
// The green gives way on the painted screens. `GOLD_SCREEN_TOKENS` and
// `MODE_SCREEN_TOKENS` re-bind every token for that subtree and a colour computed in JS
// cannot see them, so there the chips take the screen's own ink and the halo that lifts
// it off the celebration — the same trade `GOLD_DIM_INK` makes for the HOME icon.
export function EarnedAchievements({
  awards,
  halo = false,
}: {
  awards: readonly Award[]
  // Set on the gold and mode-painted game-over screens.
  halo?: boolean
}) {
  const { t } = useLingui()
  const { colorScheme } = useTheme()
  if (!isNonEmptyArray(awards)) return null

  return (
    <View className="mb-6 w-full flex-row flex-wrap items-center justify-center gap-1.5">
      {awards.map((award) => (
        <View
          key={awardKey(award)}
          className="flex-row items-center gap-1 rounded-full bg-card px-2 py-1"
        >
          <Text selectable={false} className="text-[10px] leading-[13px]">
            {ACHIEVEMENTS[award.id].emblem}
          </Text>
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-mono text-[9px] font-black leading-[13px] tracking-[1px]"
            // The chip sits on its own surface, so the halo is only for the label
            // outside it — inside, the ink just has to suit the card.
            style={halo ? null : { color: ACHIEVEMENT_INK[colorScheme] }}
          >
            {t(ACHIEVEMENTS[award.id].title)}
            {award.stage === null ? '' : ` · ${t(DIFFICULTIES[award.stage].code)}`}
          </Text>
        </View>
      ))}
    </View>
  )
}
