import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { CompareHeadSide, HEAD_NAME_LINE } from '@/components/overlays/compare-head-side'
import { TYPE } from '@/constants/typography'
import type { ChampionMark } from '@/lib/champions'
import { cn } from '@/lib/cn'
import type { VerdictKey } from '@/lib/compare'
import type { Medal } from '@/lib/medals'
import { raceMarks } from '@/lib/race-marks'

// Both players, over the table they are being compared on.
//
// It replaces the small YOU / <name> headings that used to sit over the two columns of
// figures. Those were 8px and cut to twelve characters, which made the one thing the screen
// is actually about — which two people these numbers belong to — the quietest thing on it.
//
// Nothing here is judged in figures any more. The score between the two sides used to sit
// under each name in gold; it reads as a row of the table now, at the foot of the boards it
// counts, and the sentence under this header says what the whole table came to. What is left
// is who these two are, what each of them holds, and — over a player with no board of their
// own to wear a mark for — how the race between them is going.
export function CompareHead({
  myId,
  myNickname,
  myAvgAccuracy,
  myAvgSpeed,
  myMark,
  myMedals,
  theirId,
  theirNickname,
  theirAvgAccuracy,
  theirAvgSpeed,
  theirMark,
  theirMedals,
  verdict,
}: {
  // Both ids, so either name can open the player behind it. The table already holds them
  // to ask the champions who wears a mark; this is the second thing they are for.
  myId: string
  myNickname: string
  myAvgAccuracy: number | null
  myAvgSpeed: number | null
  myMark: ChampionMark | null
  myMedals: readonly Medal[]
  theirId: string
  theirNickname: string
  theirAvgAccuracy: number | null
  theirAvgSpeed: number | null
  theirMark: ChampionMark | null
  theirMedals: readonly Medal[]
  // What the table came to. The same verdict the sentence below is drawn from, so the pair
  // of animals and the pair of lines are one reading of one table rather than two.
  verdict: VerdictKey
}) {
  const race = raceMarks(verdict)
  return (
    // Hung from the top rather than centred: each half is as tall as its own medal line, and
    // a row centring on the taller of the two would drop the shorter side's name below its
    // neighbour's for no reason the reader could see.
    <View className="flex-row items-start">
      <CompareHeadSide
        userId={myId}
        nickname={myNickname}
        avgAccuracy={myAvgAccuracy}
        avgSpeed={myAvgSpeed}
        mark={myMark}
        raceMark={race.mine}
        medals={myMedals}
      />
      {/* Set low and dim on purpose: it is punctuation between the two names rather than a
          third thing on the row. Dropped to the names' own line and centred on it, so it
          lands between them whether or not either side wears a champion mark above and
          however many medals either side has hanging below. */}
      <View
        className="w-8 justify-center"
        style={{ marginTop: HEAD_NAME_LINE.top, height: HEAD_NAME_LINE.height }}
      >
        <Text
          selectable={false}
          className={cn(TYPE.sectionLabel, 'text-center text-dim')}
        >
          <Trans>VS</Trans>
        </Text>
      </View>
      <CompareHeadSide
        userId={theirId}
        nickname={theirNickname}
        avgAccuracy={theirAvgAccuracy}
        avgSpeed={theirAvgSpeed}
        mark={theirMark}
        raceMark={race.theirs}
        medals={theirMedals}
      />
    </View>
  )
}
