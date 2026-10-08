import { Text, View } from 'react-native'

import { READOUT } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { compactNumber } from '@/lib/compact-number'

// The player's fortune, on one line under their name — everything they have ever scored,
// weighted by the difficulty it was scored on.
//
// The seven-segment face every score in the app wears, at headline size — and shortened,
// because a career total runs into the millions and the full figure would either wrap or
// shrink until it stopped reading as a headline. The exact, unweighted numbers live in
// the per-board table below.
//
// The suffix is set in mono beside the digits rather than with them: DSEG7 draws digits
// from seven segments and has no letter to make a `k` out of.
//
// The one thing in the profile's column that adds to its parent's gap. The column sets
// one rhythm for everything in it, and at that rhythm the card's headline figure stood as
// close to the medal line above it and the stat row below as those two stand to each
// other — which made the one number the card is about read as the third item in a list.
// Padding on itself rather than a margin, per the layout guide: it is air the figure
// brings with it wherever it is drawn, not a gap negotiated with a sibling that may not
// be rendered.
export function ProfileScore({
  score,
  digitFont,
}: {
  score: number
  // The seven-segment face, or `mono` until it loads — resolved by the modal so the
  // parts of it that show numbers all ask for the font once.
  digitFont: string
}) {
  const { value, suffix } = compactNumber(score)

  return (
    <View className="flex-row items-baseline justify-center gap-1 py-2">
      <Text
        selectable={false}
        className={cn(READOUT.scoreLarge, 'text-score')}
        style={{ fontFamily: digitFont }}
      >
        {value}
      </Text>
      {suffix !== '' && (
        <Text
          selectable={false}
          className="font-mono text-[18px] font-black tracking-[1px] text-score"
        >
          {suffix}
        </Text>
      )}
    </View>
  )
}
