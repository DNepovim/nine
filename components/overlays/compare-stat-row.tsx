import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { CompareValue } from '@/components/overlays/compare-value'
import { toneFor, type CompareSide, type CompareStat } from '@/lib/compare'
import { formatGameTime } from '@/lib/duration'

// A figure neither player has produced. The em dash the profile's board rows already use,
// for the same reason: an average over no hits is not an average of zero.
const NOTHING = '—'

const STAT_LABEL = {
  rating: msg`RATING`,
  runs: msg`RUNS`,
  hits: msg`HITS`,
  time: msg`TIME`,
  accuracy: msg`AVG ACC`,
  speed: msg`AVG SPD`,
  achievements: msg`ACHIEVEMENTS`,
} as const satisfies Record<CompareStat, MessageDescriptor>

// How each figure is written. The counters are bare, the averages carry their sign, and the
// duration is formatted the way the run stats and the profile format one — the same
// `formatGameTime` rather than a second opinion about what a length of play looks like.
//
// A career with nothing timed says 0 rather than 0″: on a run's stats a duration of zero
// seconds is a real answer about a real run, and here it means no run has been timed yet.
// The profile's TIME cell draws the same distinction.
const FORMAT = {
  rating: (value) => String(value),
  runs: (value) => String(value),
  hits: (value) => String(value),
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
}: {
  stat: CompareStat
  // Null for a figure this side has not produced — an average over no hits. Never zero
  // standing in for absent; the two are different answers and read differently.
  mine: number | null
  theirs: number | null
  leader: CompareSide
}) {
  const { t } = useLingui()
  const write = (value: number | null): string =>
    value === null ? NOTHING : FORMAT[stat](value)
  return (
    <View className="h-7 flex-row items-center">
      <Text
        selectable={false}
        numberOfLines={1}
        className="flex-1 font-mono text-[9px] font-bold tracking-[1px] text-dim"
      >
        {t(STAT_LABEL[stat])}
      </Text>
      <CompareValue text={write(mine)} tone={toneFor(leader, 'mine')} />
      <CompareValue text={write(theirs)} tone={toneFor(leader, 'theirs')} />
    </View>
  )
}
