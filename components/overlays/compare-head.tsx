import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { CompareHeadSide } from '@/components/overlays/compare-head-side'
import type { ChampionMark } from '@/lib/champions'
import { toneFor, type CompareSide, type Tally } from '@/lib/compare'

// Both players, over the table they are being compared on.
//
// It replaces the small YOU / <name> headings that used to sit over the two columns of
// figures. Those were 8px and cut to twelve characters, which made the one thing the screen
// is actually about — which two people these numbers belong to — the quietest thing on it.
export function CompareHead({
  myNickname,
  myAvgAccuracy,
  myAvgSpeed,
  myMark,
  theirNickname,
  theirAvgAccuracy,
  theirAvgSpeed,
  theirMark,
  tally,
}: {
  myNickname: string
  myAvgAccuracy: number | null
  myAvgSpeed: number | null
  myMark: ChampionMark | null
  theirNickname: string
  theirAvgAccuracy: number | null
  theirAvgSpeed: number | null
  theirMark: ChampionMark | null
  tally: Tally
}) {
  // The header is judged by the same function every row under it is judged by, so the two
  // can never disagree about what being ahead looks like. A level table leaves both sides
  // plain, which is what makes a decided one read as decided.
  const leader: CompareSide =
    tally.mine === tally.theirs ? null : tally.mine > tally.theirs ? 'mine' : 'theirs'
  return (
    <View className="flex-row items-center">
      <CompareHeadSide
        nickname={myNickname}
        avgAccuracy={myAvgAccuracy}
        avgSpeed={myAvgSpeed}
        mark={myMark}
        wins={tally.mine}
        tone={toneFor(leader, 'mine')}
      />
      {/* Set low and dim on purpose: it is punctuation between the two names rather than a
          third thing on the row. */}
      <Text
        selectable={false}
        className="w-8 text-center font-mono text-[9px] font-black tracking-[2px] text-dim"
      >
        <Trans>VS</Trans>
      </Text>
      <CompareHeadSide
        nickname={theirNickname}
        avgAccuracy={theirAvgAccuracy}
        avgSpeed={theirAvgSpeed}
        mark={theirMark}
        wins={tally.theirs}
        tone={toneFor(leader, 'theirs')}
      />
    </View>
  )
}
