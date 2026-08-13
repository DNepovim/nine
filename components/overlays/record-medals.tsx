import { isEmptyArray } from 'narrowland'
import { Text, View } from 'react-native'

import type { Period } from '@/lib/announcements'
import { rankMedal } from '@/lib/rank-emoji'
import { MODE_GRADIENT, type Mode } from '@/machines/game'

// The board's own words for its periods, so a medal and the tab it was won on say the
// same thing.
const PERIOD_LABEL = {
  ever: 'EVER',
  week: 'THIS WEEK',
  today: 'TODAY',
} as const satisfies Record<Period, string>

// What the run just took, under the score: a gold for every board it ended on top of.
//
// Gold on all of them, not a descending podium — these are three separate boards and
// the player leads each one, so a silver would be saying something untrue about the
// week. The mode's accent colours the labels, the same hue the leaderboard gives it.
export function RecordMedals({
  periods,
  gameMode,
}: {
  periods: readonly Period[]
  gameMode: Mode
}) {
  if (isEmptyArray(periods)) return null

  return (
    <View className="mb-5 flex-row items-center justify-center gap-3">
      {periods.map((period) => (
        <View key={period} className="flex-row items-center gap-1">
          <Text selectable={false} className="text-[13px] leading-[15px]">
            {rankMedal(1)}
          </Text>
          <Text
            selectable={false}
            className="font-mono text-[9px] font-black leading-[15px] tracking-[1px]"
            style={{ color: MODE_GRADIENT[gameMode][0] }}
          >
            {PERIOD_LABEL[period]}
          </Text>
        </View>
      ))}
    </View>
  )
}
