import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Text } from 'react-native'

import { CompareRow } from '@/components/overlays/compare-row'
import { CompareValue } from '@/components/overlays/compare-value'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { toneFor, type CompareSide, type CompareStat } from '@/lib/compare'
import { formatGameTime } from '@/lib/duration'
import { groupDigits } from '@/lib/group-digits'

// A figure neither player has produced. The em dash the profile's board rows already use,
// for the same reason: an average over no hits is not an average of zero.
const NOTHING = '—'

const STAT_LABEL = {
  fortune: msg`FORTUNE`,
  runs: msg`RUNS`,
  hits: msg`HITS`,
  time: msg`TIME`,
  accuracy: msg`AVG ACC`,
  speed: msg`AVG SPD`,
  achievements: msg`ACHIEVEMENTS`,
} as const satisfies Record<CompareStat, MessageDescriptor>

// How each figure is written. The counters have their thousands marked off, the averages
// carry their sign, and the duration is formatted the way the run stats format one — the
// same `formatGameTime` rather than a second opinion about what a length of play looks
// like. Not the profile's `formatCareerTime`: that cell is one figure read at a glance and
// says only its largest unit, where these two sit side by side to be told apart, and two
// careers a few hours apart would read as the same number.
//
// A fortune runs to seven figures and a career's hits to five, and an unbroken run of that
// many digits in an 11px column is a number the reader counts rather than reads. `groupDigits`
// is only ever asked of the three that get that long; a percentage and a count of
// achievements never reach a thousand, and asking it of them would say they might.
//
// A career with nothing timed says 0 rather than 0″: on a run's stats a duration of zero
// seconds is a real answer about a real run, and here it means no run has been timed yet.
// The profile's TIME cell draws the same distinction.
const FORMAT = {
  fortune: groupDigits,
  runs: groupDigits,
  hits: groupDigits,
  time: (value) => (value > 0 ? formatGameTime(value) : '0'),
  accuracy: (value) => `${value}%`,
  speed: (value) => `${value}%`,
  // The count held, bare — not the fraction the profile card prints. The catalogue is the
  // same size for both players, so writing it twice on one row says nothing about either
  // of them and costs the column the width its figures need.
  achievements: (value) => String(value),
} as const satisfies Record<CompareStat, (value: number) => string>

// One lifetime row of the comparison table: what this stat is, what each side has, and
// which of them that gives the row to.
export function CompareStatRow({
  stat,
  mine,
  theirs,
  leader,
  index,
}: {
  stat: CompareStat
  // Null for a figure this side has not produced — an average over no hits. Never zero
  // standing in for absent; the two are different answers and read differently.
  mine: number | null
  theirs: number | null
  leader: CompareSide
  // Where this row falls in the table, which is the only thing deciding when it arrives.
  index: number
}) {
  const { t } = useLingui()
  const write = (value: number | null): string =>
    value === null ? NOTHING : FORMAT[stat](value)
  return (
    <CompareRow index={index}>
      <Text
        selectable={false}
        numberOfLines={1}
        className={cn(TYPE.labelSm, 'flex-1 text-dim')}
      >
        {t(STAT_LABEL[stat])}
      </Text>
      <CompareValue text={write(mine)} tone={toneFor(leader, 'mine')} />
      <CompareValue text={write(theirs)} tone={toneFor(leader, 'theirs')} />
    </CompareRow>
  )
}
