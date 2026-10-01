import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { View } from 'react-native'

import { StatCell } from '@/components/overlays/stat-cell'
import { formatGameTime } from '@/lib/duration'

// What an arcade run leaves behind, on both the pause screen and the end of it. One
// component for the same reason `RunStats` is one: two screens, one answer, and no way for
// them to drift apart.
//
// Not `RunStats` itself. That one reads a run's hits, its averages and the factor its mode
// was being judged on, and arcade has none of those — what it has is how deep it got, how
// many crossroads it took two at a time, and how long it was at it. Same cells, same row,
// different three numbers.
//
// Depth is not here: it is the score, so it stands above this in the readout the game puts
// its score in.
export function ArcadeStats({
  strikes,
  playedMs,
}: {
  strikes: number
  playedMs: number
}) {
  const { t } = useLingui()

  const cells = [
    { key: 'strikes', label: msg`STRIKES`, value: `${strikes}`, overhang: false },
    // The one value ending in a unit mark, which hangs outside its cell so that the digits
    // — not the digits plus the mark — are what sits centred over the label.
    { key: 'time', label: msg`TIME`, value: formatGameTime(playedMs), overhang: true },
  ]

  return (
    <View className="mb-6 w-full flex-row items-start justify-center gap-x-5">
      {cells.map(({ key, label, value, overhang }) => (
        <StatCell key={key} label={t(label)} value={value} overhang={overhang} />
      ))}
    </View>
  )
}
