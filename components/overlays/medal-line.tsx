import { isEmptyArray } from 'narrowland'
import { Fragment } from 'react'
import { Text, View } from 'react-native'

import type { Medal, MedalPeriod } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import { DIFFICULTIES, MODE_GRADIENT } from '@/machines/game'

// How long the board has stood, in the same clipped register as the difficulty code
// beside it. A medal without this reads as all-time, which is the rarest of the three
// and the one nobody should be handed by default.
const PERIOD_CODES = {
  today: 'DAY',
  week: 'WK',
  ever: 'ALL',
} as const satisfies Record<MedalPeriod, string>

// The player's best claim in each mode, under the title. The difficulty is spelled; the
// mode is the colour it is spelled in — the same accent the leaderboard gives that mode,
// so the two agree on which hue means what.
//
// No cap here any more: `toMedals` keeps one medal per mode, so the line is as long as
// there are modes to win in and cannot outgrow the title above it.
export function MedalLine({ medals }: { medals: readonly Medal[] }) {
  if (isEmptyArray(medals)) return null

  return (
    <View className="mb-4 flex-row items-center justify-center gap-1.5">
      {medals.map((medal, i) => (
        <Fragment key={medal.mode}>
          {i > 0 && (
            <Text selectable={false} className="font-mono text-[9px] text-dim">
              ·
            </Text>
          )}
          <View className="flex-row items-center gap-1">
            <Text selectable={false} className="text-[11px] leading-[13px]">
              {rankMedal(medal.rank)}
            </Text>
            {/* Board then period, one shade apart: the board is what was won and
                wears the mode's colour, the period is the qualifier and sits back
                in dim, so a glance reads the medals before it reads the windows. */}
            <Text
              selectable={false}
              className="font-mono text-[9px] font-black leading-[13px] tracking-[1px]"
              style={{ color: MODE_GRADIENT[medal.mode][0] }}
            >
              {DIFFICULTIES[medal.difficulty].code}
            </Text>
            <Text
              selectable={false}
              className="font-mono text-[8px] font-bold leading-[13px] tracking-[0.5px] text-dim"
            >
              {PERIOD_CODES[medal.period]}
            </Text>
          </View>
        </Fragment>
      ))}
    </View>
  )
}
