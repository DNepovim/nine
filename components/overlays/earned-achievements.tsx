import { useLingui } from '@lingui/react/macro'
import { isNonEmptyArray } from 'narrowland'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { AchievementDetail } from '@/components/overlays/achievement-detail'
import { ACHIEVEMENTS, type AchievementId } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import type { AchievementStore } from '@/lib/achievement-store'
import {
  awardKey,
  STAGE_CODE,
  type AchievementFacts,
  type Award,
} from '@/lib/achievements'
import { cn } from '@/lib/cn'

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
  store,
  facts,
  halo = false,
}: {
  awards: readonly Award[]
  // Both only for the card a tapped chip opens — it draws the achievements screen's own
  // row, which answers out of these two the same way that screen does.
  store: AchievementStore
  facts: AchievementFacts
  // Set on the gold and mode-painted game-over screens.
  halo?: boolean
}) {
  const { t } = useLingui()
  const { colorScheme } = useTheme()
  // Which chip's card is open, or null. Held here rather than by the game over screen:
  // the row is the only thing that knows a chip was tapped, and nothing else on that
  // screen has to care that this opened.
  const [asked, setAsked] = useState<AchievementId | null>(null)
  // Declared before the early return below — bailing out first would make the state
  // above a conditional hook and desync the hook order on a later render.
  if (!isNonEmptyArray(awards)) return null

  // The card opens as a slider over everything the run earned, so a player who unlocked
  // three can read all three without going back out to the row between them. Over the
  // achievements rather than over the chips: two stages of the same one are two chips and
  // a single card, since the card is about the achievement.
  const ids = [...new Set(awards.map((award) => award.id))]

  return (
    <View className="mb-6 w-full flex-row flex-wrap items-center justify-center gap-1.5">
      {awards.map((award) => (
        // A chip has looked pressable since the day it was drawn — pill-shaped, on its
        // own surface — and did nothing. It answers now: what the achievement asked of
        // you, which the name alone rarely says.
        <Pressable
          key={awardKey(award)}
          onPress={() => {
            setAsked(award.id)
          }}
        >
          {({ pressed }) => (
            <View
              className={cn(
                'flex-row items-center gap-1 rounded-full bg-card px-2 py-1',
                pressed && 'opacity-60',
              )}
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
                {award.stage === null ? '' : ` · ${t(STAGE_CODE[award.stage])}`}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
      {asked !== null && (
        <AchievementDetail
          ids={ids}
          start={Math.max(0, ids.indexOf(asked))}
          store={store}
          facts={facts}
          onDismiss={() => {
            setAsked(null)
          }}
        />
      )}
    </View>
  )
}
