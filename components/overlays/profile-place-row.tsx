import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { GradientText } from '@/components/gradient-text'
import { GLYPH, TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/format-date'
import type { SessionPlace } from '@/lib/player-profile'
import { rankMedal } from '@/lib/rank-emoji'
import { sessionFigure } from '@/lib/session-figure'
import { gradientOf, labelOf } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

// One podium on the profile's CHALLENGES list: the metal, the challenge, the day its
// window shut, and the figure the place was taken with.
//
// The same four-beat row `ProfileReignRow` draws for a board, and in the same order for
// the same reason — what was taken, where, and when — with the figure added at the end,
// because a session is over and its standings will never move again, so the number is
// part of the record in a way a board's is not.
//
// The metal varies here where the reign list's never does: a reign is a board held, and
// holding is rank one, but a session pays all three places and this list keeps all three.
//
// The name in the challenge's own gradient, the way every other place draws one — a
// challenge *is* its colour. `challengeInk` over **both** stops, as `ChallengeTitle` and
// the intro's card do: the raw `[0]` is the near-black every challenge shares and the raw
// `[1]` is too bright to carry a word, so each is lifted to a text lightness first.
//
// The date is when the session closed rather than when the run was played: a place is
// settled at the close and not a moment before it.
//
// The figure is the session's own **measure**: its score, on a race its time, on a hits
// session its hits — see `sessionFigure`.
export function ProfilePlaceRow({ place }: { place: SessionPlace }) {
  const { t } = useLingui()
  // Ungrouped on a score session, as this row has always printed it: the h-7 row beside
  // the date has no room to spare for the separators the summary's larger figures get.
  const figure =
    place.measure === 'score' ? String(place.score) : sessionFigure(place.measure, place)

  return (
    <View className="h-7 flex-row items-center gap-2">
      <Text selectable={false} className={cn(GLYPH.sm, 'leading-[13px]')}>
        {rankMedal(place.rank) ?? ''}
      </Text>
      <GradientText
        text={t(labelOf(place.modeId))}
        from={challengeInk(gradientOf(place.modeId)[0])}
        to={challengeInk(gradientOf(place.modeId)[1])}
        numberOfLines={1}
        className={cn(TYPE.label, 'flex-1')}
      />
      <Text
        selectable={false}
        numberOfLines={1}
        className={cn(TYPE.hint, 'w-14 text-right text-dim')}
      >
        {formatShortDate(place.closesAt)}
      </Text>
      <Text
        selectable={false}
        numberOfLines={1}
        className={cn(TYPE.figure, 'w-14 text-right text-primary')}
      >
        {figure}
      </Text>
    </View>
  )
}
