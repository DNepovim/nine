import { Ionicons } from '@expo/vector-icons'
import { useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { Fragment } from 'react'
import { Pressable, Text, View } from 'react-native'

import { DIM_INK } from '@/constants/colors'
import { useTheme } from '@/hooks/use-theme'
import { PERIOD_CODES, type Medal } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import { DIFFICULTIES, MODE_GRADIENT } from '@/machines/game'

// The player's best claim in each mode, under the title. The difficulty is spelled; the
// mode is the colour it is spelled in — the same accent the leaderboard gives that mode,
// so the two agree on which hue means what.
//
// No cap here any more: `toMedals` keeps one medal per mode, so the line is as long as
// there are modes to win in and cannot outgrow the title above it.
export function MedalLine({
  medals,
  onPress,
}: {
  medals: readonly Medal[]
  // Opens the full list behind this line: every medal rather than one per mode, and what
  // has been taken off the player this week. Omitted on a profile, where the line speaks
  // for somebody else and there is nothing of theirs to open.
  onPress?: () => void
}) {
  const { t } = useLingui()
  const { colorScheme } = useTheme()
  if (isEmptyArray(medals)) return null

  const entries = (
    <>
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
              {t(DIFFICULTIES[medal.difficulty].code)}
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
    </>
  )

  if (onPress === undefined) {
    return <View className="flex-row items-center justify-center gap-1.5">{entries}</View>
  }

  // The same chevron the achievement line wears, for the same reason and in the same
  // place: the two take turns in one slot under the title, and a way in that appeared on
  // one of them and not the other would read as the line having changed rather than as
  // the other one arriving. Dim rather than a medal's gold — there are three hues in the
  // line already, and the arrow is not one of the things being reported.
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="flex-row items-center justify-center gap-1.5"
    >
      {entries}
      <Ionicons name="chevron-forward" size={10} color={DIM_INK[colorScheme]} />
    </Pressable>
  )
}
