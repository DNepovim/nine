import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TakerName } from '@/components/overlays/taker-name'
import { GRAYSCALE } from '@/constants/colors'
import { useChampionsContext } from '@/hooks/use-champions'
import { displayName } from '@/lib/announcements'
import { championMark } from '@/lib/champions'
import type { Taker } from '@/lib/lost-medals'
import { PERIOD_CODES, type MedalPeriod } from '@/lib/medals'
import { rankMedal } from '@/lib/rank-emoji'
import { DIFFICULTIES, MODES, type Difficulty, type ScoredMode } from '@/machines/game'

// The medal line's own entry, with the colour drained out of it — greyscale is what the
// app already uses for a record taken off you, and here it is half the message: the
// player sees the shape of something they wore under their name, in the wrong colour.
// The other half is whose name is on it now.
//
// The mode is spelled rather than left to its accent. In the medal line the hue is enough
// because there are entries beside each other to tell apart; alone, a grey word has no
// hue left to read, so the name has to be there instead.
export function LostMedalLine({
  mode,
  difficulty,
  period,
  rank,
  taker,
}: {
  mode: ScoredMode
  difficulty: Difficulty
  period: MedalPeriod
  // The metal that was taken, not whatever is left.
  rank: 1 | 2 | 3
  // Who holds it now, or null when the board could not say — a medal is gone whether or
  // not there is a name to put to it, so the line still runs without one.
  taker: Taker | null
}) {
  const { t } = useLingui()
  // The same mark this player wears beside their name on the leaderboard and in a room.
  // Whoever took the board is quite likely to be wearing one.
  const champions = useChampionsContext()

  return (
    <View className="flex-row items-center justify-center gap-1">
      <Text selectable={false} className="text-[11px] leading-[13px] opacity-40">
        {rankMedal(rank)}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[9px] font-black leading-[13px] tracking-[1px]"
        style={{ color: GRAYSCALE[1] }}
      >
        {t(MODES[mode].label)} {t(DIFFICULTIES[difficulty].code)}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold leading-[13px] tracking-[0.5px] text-dim"
      >
        {PERIOD_CODES[period]}
      </Text>
      <Text selectable={false} className="font-mono text-[9px] leading-[13px] text-dim">
        ·
      </Text>
      {taker === null ? (
        <Text
          selectable={false}
          className="font-mono text-[9px] font-black leading-[13px] tracking-[1px]"
          style={{ color: GRAYSCALE[1] }}
        >
          <Trans>TAKEN</Trans>
        </Text>
      ) : (
        // The name is wrapped in a component rather than interpolated so the translated
        // sentence carries a `<0/>` the translator can move — Czech does not put the
        // taker where English does. The same arrangement the winners stripe uses.
        //
        // It stays a shade brighter and a size larger than the words around it, because
        // the name is the news: everything else on this line the player already knew.
        //
        // `TakerName` and not the gradient `WinnerName` the winners stripe uses — see
        // that file for why this one line keeps a name flat and grey.
        <Text
          selectable={false}
          className="font-mono text-[9px] font-bold leading-[13px] tracking-[1px] text-dim"
        >
          <Trans>
            TAKEN BY{' '}
            <TakerName
              userId={taker.userId}
              nickname={displayName(taker.nickname)}
              mark={championMark(taker.userId, champions)}
              color={GRAYSCALE[1]}
            />
          </Trans>
        </Text>
      )}
    </View>
  )
}
