import { Text, View } from 'react-native'

import { compactNumber } from '@/lib/compact-number'

// The player's rating, on one line under their name — everything they have ever scored,
// weighted by the difficulty it was scored on.
//
// The seven-segment face every score in the app wears, at headline size — and shortened,
// because a career total runs into the millions and the full figure would either wrap or
// shrink until it stopped reading as a headline. The exact, unweighted numbers live in
// the per-board table below.
//
// The suffix is set in mono beside the digits rather than with them: DSEG7 draws digits
// from seven segments and has no letter to make a `k` out of.
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
    <View className="flex-row items-baseline justify-center gap-1">
      <Text
        selectable={false}
        className="text-[38px] tracking-[2px] text-score"
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
