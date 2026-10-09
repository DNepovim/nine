import { useLingui } from '@lingui/react/macro'
import { isNonEmptyArray } from 'narrowland'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { AchievementDetail } from '@/components/overlays/achievement-detail'
import { TrackedPressable } from '@/components/tracked-pressable'
import { ACHIEVEMENTS, type AchievementId } from '@/constants/achievements'
import { ACHIEVEMENT_INK } from '@/constants/colors'
import { GLYPH, TYPE } from '@/constants/typography'
import type { AchievementStore } from '@/lib/achievement-store'
import {
  achievementCard,
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
// Always one row, scrolling sideways when the chips outrun the width. They used to wrap,
// which on a good run pushed the buttons below off the bottom of the screen — and the
// number of lines the row took was then a surprise the rest of the screen had to absorb.
// One line of a fixed height is a shape the screen can be laid out around, whether the
// run earned one achievement or six.
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
  // Which chip's card is open, or null. Held here rather than by the game over screen:
  // the row is the only thing that knows a chip was tapped, and nothing else on that
  // screen has to care that this opened.
  const [asked, setAsked] = useState<AchievementId | null>(null)
  // Declared before the early return below — bailing out first would make the state
  // above a conditional hook and desync the hook order on a later render.
  if (!isNonEmptyArray(awards)) return null

  // The card opens as a slider over everything the run earned, so a player who unlocked
  // three can read all three without going back out to the row between them. Shared with
  // the announcement bar, which opens the same card on a tap mid-run.
  const card = asked === null ? null : achievementCard(awards, asked)

  return (
    <View className="mb-6 w-full">
      {/* `flexGrow` on the content is what makes one chip sit in the middle and six
          start at the left edge: the row is centred while it fits and becomes a scroll
          the moment it does not. The side padding is the scroll's own, so the first and
          last chip clear the edge they come to rest against. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 2,
        }}
      >
        {awards.map((award) => (
          // A chip has looked pressable since the day it was drawn — pill-shaped, on its
          // own surface — and did nothing. It answers now: what the achievement asked of
          // you, which the name alone rarely says.
          <TrackedPressable
            id="achievements.earned"
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
                <Text selectable={false} className={cn(GLYPH.xs, 'leading-[13px]')}>
                  {ACHIEVEMENTS[award.id].emblem}
                </Text>
                <Text
                  selectable={false}
                  numberOfLines={1}
                  className={cn(TYPE.rowLabel, 'leading-[13px]')}
                  // The chip sits on its own surface, so the halo is only for the label
                  // outside it — inside, the ink just has to suit the card.
                  style={halo ? null : { color: ACHIEVEMENT_INK }}
                >
                  {t(ACHIEVEMENTS[award.id].title)}
                  {award.stage === null ? '' : ` · ${t(STAGE_CODE[award.stage])}`}
                </Text>
              </View>
            )}
          </TrackedPressable>
        ))}
      </ScrollView>
      {card !== null && (
        <AchievementDetail
          ids={card.ids}
          start={card.start}
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
