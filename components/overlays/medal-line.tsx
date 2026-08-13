import { isEmptyArray } from 'narrowland'
import { Fragment } from 'react'
import { Text, View } from 'react-native'

import type { Medal } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import { DIFFICULTIES, MODE_GRADIENT } from '@/machines/game'

// All six boards can be medalled at once, and six items overrun the title's width. The
// sort has already put the best first, so the cut takes the least worth showing.
const MAX_ITEMS = 4

// The player's all-time podium finishes, under the title. The difficulty is spelled;
// the mode is the colour it is spelled in — the same accent the leaderboard gives that
// mode, so the two agree on which hue means what.
export function MedalLine({ medals }: { medals: readonly Medal[] }) {
  if (isEmptyArray(medals)) return null

  return (
    <View className="mb-4 flex-row items-center justify-center gap-1.5">
      {medals.slice(0, MAX_ITEMS).map((medal, i) => (
        <Fragment key={`${medal.mode}-${medal.difficulty}`}>
          {i > 0 && (
            <Text selectable={false} className="font-mono text-[9px] text-dim">
              ·
            </Text>
          )}
          <View className="flex-row items-center gap-1">
            <Text selectable={false} className="text-[11px] leading-[13px]">
              {rankMedal(medal.rank)}
            </Text>
            <Text
              selectable={false}
              className="font-mono text-[9px] font-black leading-[13px] tracking-[1px]"
              style={{ color: MODE_GRADIENT[medal.mode][0] }}
            >
              {DIFFICULTIES[medal.difficulty].code}
            </Text>
          </View>
        </Fragment>
      ))}
    </View>
  )
}
