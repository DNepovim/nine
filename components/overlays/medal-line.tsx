import { Ionicons } from '@expo/vector-icons'
import { useLingui } from '@lingui/react/macro'
import { isEmptyArray } from 'narrowland'
import { Fragment } from 'react'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { GLYPH, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { PERIOD_CODES, type Medal } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import { DIFFICULTIES, gradientOf } from '@/modes'

// The player's best claim in each mode, under the title. The difficulty is spelled; the
// mode is the colour it is spelled in — the same accent the leaderboard gives that mode,
// so the two agree on which hue means what.
//
// No cap here any more: `toMedals` keeps one medal per mode, so the line is as long as
// there are modes to win in and cannot outgrow the title above it.
export function MedalLine({
  medals,
  wrap = false,
  onPress,
}: {
  medals: readonly Medal[]
  // Set where the line has half a card to live in rather than the whole of one — the two
  // heads of the comparison table. The entries then break onto a second line instead of
  // running out under the column beside them, and the separating dots come off: a dot is
  // punctuation between two entries on one line, and a line that ended in one would read
  // as a sentence that had been cut off. The gap does the separating instead.
  //
  // Off everywhere there is room for the line in full, which is the intro and the profile.
  wrap?: boolean
  // Opens the full list behind this line: every medal rather than one per mode, and what
  // has been taken off the player this week. Omitted on a profile, where the line speaks
  // for somebody else and there is nothing of theirs to open.
  onPress?: () => void
}) {
  const { t } = useLingui()
  if (isEmptyArray(medals)) return null

  const entries = (
    <>
      {medals.map((medal, i) => (
        <Fragment key={medal.mode}>
          {i > 0 && !wrap && (
            <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
              ·
            </Text>
          )}
          <View className="flex-row items-center gap-1">
            <Text selectable={false} className={cn(GLYPH.sm, 'leading-[13px]')}>
              {rankMedal(medal.rank)}
            </Text>
            {/* Board then period, one shade apart: the board is what was won and
                wears the mode's colour, the period is the qualifier and sits back
                in dim, so a glance reads the medals before it reads the windows. */}
            <Text
              selectable={false}
              className={cn(TYPE.rowLabel, 'leading-[13px]')}
              style={{ color: gradientOf(medal.mode)[0] }}
            >
              {t(DIFFICULTIES[medal.difficulty].code)}
            </Text>
            <Text
              selectable={false}
              className={cn(TYPE.caption, 'leading-[13px] text-dim')}
            >
              {PERIOD_CODES[medal.period]}
            </Text>
          </View>
        </Fragment>
      ))}
    </>
  )

  const layout = wrap
    ? 'flex-row flex-wrap items-center justify-center gap-x-2 gap-y-0.5'
    : 'flex-row items-center justify-center gap-1.5'

  if (onPress === undefined) {
    return <View className={layout}>{entries}</View>
  }

  // The same chevron the achievement line wears, for the same reason and in the same
  // place: the two take turns in one slot under the title, and a way in that appeared on
  // one of them and not the other would read as the line having changed rather than as
  // the other one arriving. Dim rather than a medal's gold — there are three hues in the
  // line already, and the arrow is not one of the things being reported.
  return (
    <TrackedPressable id="medals.line" onPress={onPress} hitSlop={8} className={layout}>
      {entries}
      <Ionicons name="chevron-forward" size={10} color={DIM_INK} />
    </TrackedPressable>
  )
}
