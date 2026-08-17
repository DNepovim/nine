import { isEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import { ON_GOLD_LABEL_SHADOW } from '@/constants/theme'
import type { Period } from '@/lib/announcements'
import type { BoardMedal } from '@/lib/board-medals'
import { rankMedal } from '@/lib/rank-emoji'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

// The board's own words for its periods, so a medal and the tab it was won on say the
// same thing.
const PERIOD_LABEL = {
  ever: 'EVER',
  week: 'THIS WEEK',
  today: 'TODAY',
} as const satisfies Record<Period, string>

// Where the run leaves the player standing, under the score.
//
// The metal is the place, not the achievement: a bronze here means third, and it sits
// beside a gold from a shorter board without contradicting it — being first today and
// third all time is one player's honest position on two different boards. `boardMedals`
// has already dropped the periods a longer one implies, so every entry says something
// the one above it did not. The mode's accent colours the labels, the same hue the
// leaderboard gives it.
export function BoardMedals({
  medals,
  gameMode,
  shadow = false,
}: {
  medals: readonly BoardMedal[]
  gameMode: Mode
  // Set on the gold screen: these labels wear the mode's colour, which is a mid-tone
  // against gold before a pale streak even crosses it.
  shadow?: boolean
}) {
  if (isEmptyArray(medals)) return null

  return (
    <View className="mb-5 flex-row items-center justify-center gap-3">
      {medals.map(({ period, rank }) => (
        <View key={period} className="flex-row items-center gap-1">
          <Text selectable={false} className="text-[13px] leading-[15px]">
            {rankMedal(rank)}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[9px] font-black leading-[15px] tracking-[1px]"
            style={[
              { color: MODE_GRADIENT[gameMode][0] },
              shadow ? ON_GOLD_LABEL_SHADOW : null,
            ]}
          >
            {PERIOD_LABEL[period]}
          </Text>
        </View>
      ))}
    </View>
  )
}
